import { logger } from "@/lib/logger.js";
import { systemSettingRepository } from "@/repositories/SystemSettingRepository.js";
import { emailSendService } from "@/services/emailSendService.js";
import { managerLeadRatingService } from "@/services/managerLeadRatingService.js";
import { renderWeeklyManagerDigestHtml } from "@/templates/weeklyManagerDigest.js";

/** Реальные получатели (пользователь назвал их явно, 2026-09-12) — руководство,
 * не пользуется панелью, поэтому пассивная email-рассылка вместо захода в систему.
 * НЕ включает тестовый адрес — тот только через sendTestDigest(), отдельно от
 * автоматики (решение пользователя: сначала проверить на себе, потом на прод). */
const REAL_RECIPIENTS = ["a.zharikov@lemarkllc.ru", "g.smorchkov@lemarkllc.ru", "vkuzmenko@lemarkllc.ru"];
const TEST_RECIPIENT = "g.bogonos@lemarkllc.ru";

const LAST_SENT_WEEK_KEY = "weekly_manager_digest_last_sent_week";

/** Пятница, 18:00 МСК = 15:00 UTC — конец рабочей недели (ПН-ПТ 9-18, решение
 * пользователя 2026-09-12), тот же принцип определения часа, что и у
 * leadAutoStopListService.DIGEST_HOUR_UTC (тоже "конец рабочего дня по МСК"). */
const FRIDAY_SEND_HOUR_UTC = 15;

function mondayOfWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

export class WeeklyManagerDigestService {
  /** from = понедельник этой недели 00:00 UTC, to = сейчас — на момент реальной
   * отправки (пятница вечером) это и есть вся рабочая неделя целиком. */
  private async buildDigest(): Promise<{ html: string; from: Date; to: Date }> {
    const to = new Date();
    const from = mondayOfWeek(to);
    const stats = await managerLeadRatingService.getStats(from, to);
    return { html: renderWeeklyManagerDigestHtml(stats, from, to), from, to };
  }

  /** Ручной триггер для проверки перед прод-рассылкой (решение пользователя,
   * 2026-09-12) — шлёт TEST_RECIPIENT, никогда REAL_RECIPIENTS. Не привязан к
   * пятнице/расписанию, можно вызвать в любой момент. */
  async sendTestDigest(): Promise<boolean> {
    const { html } = await this.buildDigest();
    return emailSendService.sendWeeklyManagerDigest([TEST_RECIPIENT], html);
  }

  /** Дёргается поллером (server.ts) — не чаще раза в неделю, только по пятницам
   * после 18:00 МСК (см. FRIDAY_SEND_HOUR_UTC), тем же принципом "не слать раньше
   * времени, а то день ещё не закончился", что и у leadAutoStopListService. */
  async sendWeeklyDigestIfDue(): Promise<void> {
    const now = new Date();
    if (now.getUTCDay() !== 5 || now.getUTCHours() < FRIDAY_SEND_HOUR_UTC) return;

    const weekKey = mondayOfWeek(now).toISOString().slice(0, 10);
    const lastSent = await systemSettingRepository.get<string>(LAST_SENT_WEEK_KEY);
    if (lastSent === weekKey) return;

    await systemSettingRepository.set(LAST_SENT_WEEK_KEY, weekKey);
    try {
      const { html } = await this.buildDigest();
      await emailSendService.sendWeeklyManagerDigest(REAL_RECIPIENTS, html);
    } catch (error) {
      logger.error({ err: error }, "weeklyManagerDigestService: send failed");
    }
  }
}

export const weeklyManagerDigestService = new WeeklyManagerDigestService();
