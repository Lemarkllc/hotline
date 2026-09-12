import type { LeadIrrelevantCategory } from "@prisma/client";
import { logger } from "@/lib/logger.js";
import { auditRepository } from "@/repositories/AuditRepository.js";
import { systemSettingRepository } from "@/repositories/SystemSettingRepository.js";
import { leadService } from "@/services/leadService.js";
import { notificationService } from "@/services/notificationService.js";
import type { LeadAiResult } from "@/services/leadAiService.js";

/** Категории, для которых уверенность модели (см. системный промпт leadAiService)
 * достаточна для полностью автоматического скрытия без участия человека — grill-me
 * допрос 2026-09-12. OTHER — модель сама не уверена, PHISHING_ATTEMPT — обрабатывается
 * отдельно (notifyAdminPhishingAttempt), никогда не тихо стоплистится. */
const AUTO_STOPLIST_SAFE_CATEGORIES: ReadonlySet<LeadIrrelevantCategory> = new Set([
  "SPAM",
  "COURSE_OR_TRAINING",
  "VACANCY",
  "SUPPLIER_PITCH",
]);

const DIGEST_LAST_SENT_DATE_KEY = "lead_ai_stoplist_digest_last_sent_date";
const AUTO_STOPLISTED_AUDIT_ACTION = "lead.auto_stoplisted";

/** 15:00 UTC = 18:00 МСК — ближе к концу рабочего дня, чтобы к моменту дайджеста
 * накопилась вся дневная активность. Если проверять и слать сразу с полуночи, первый
 * же тик поллера с count=0 пометил бы сегодняшний день как "уже отправлено" — и
 * реальные авто-стоплисты, случившиеся позже в тот же день, потеряли бы дайджест. */
const DIGEST_HOUR_UTC = 15;

/**
 * Асимметричный авто-стоплист (grill-me допрос 2026-09-12) — симметричная фича к
 * автопередаче релевантных лидов в CRM, но с противоположным риск-профилем:
 * ложноположительный auto-convert стоит лишней ручной работы на пару минут,
 * ложноотрицательный auto-stoplist — молча потерянный реальный клиент, поэтому
 * рубильник по умолчанию выключен (leadService.getAutoStopListSetting) и категории
 * заведомо у́же, чем всё is_relevant:false целиком.
 */
export class LeadAutoStopListService {
  /** Вызывается из emailIngestService сразу после markAiClassified, только в ветке
   * isRelevant:false. PHISHING_ATTEMPT — вне рубильника (это сигнал безопасности,
   * не workflow-автоматизация) — алертит Администратора независимо от настройки. */
  async handleIrrelevant(lead: { id: string; publicNumber: string }, aiResult: LeadAiResult): Promise<void> {
    if (aiResult.irrelevantCategory === "PHISHING_ATTEMPT") {
      try {
        await notificationService.notifyAdminPhishingAttempt(lead);
      } catch (error) {
        logger.error({ err: error, leadId: lead.id }, "leadAutoStopListService: phishing notify failed");
      }
      return;
    }

    if (!aiResult.irrelevantCategory || !AUTO_STOPLIST_SAFE_CATEGORIES.has(aiResult.irrelevantCategory)) return;

    const enabled = await leadService.getAutoStopListSetting();
    if (!enabled) return;

    try {
      await leadService.autoStopList(lead.id, aiResult.irrelevantCategory, aiResult.reasoning);
    } catch (error) {
      // Молчаливый пропуск — тем же принципом, что и в emailIngestService: лид просто
      // остаётся как есть, видимым в общем реестре (то самое состояние, в котором он
      // был бы без этой фичи вообще), ничего не потеряно.
      logger.error({ err: error, leadId: lead.id }, "leadAutoStopListService: auto-stoplist failed");
    }
  }

  /** Раз в сутки — не чаще: сравнивает сохранённую дату последней отправки с сегодняшней
   * (UTC), считает count через audit_log (та же запись, что делает autoStopList выше)
   * и шлёт один батч-дайджест SALES, если count > 0. Дергается поллером (server.ts),
   * достаточно раз в 30 минут — сама дата гарантирует, что за сутки уйдёт только один. */
  async sendDailyDigestIfDue(): Promise<void> {
    const now = new Date();
    if (now.getUTCHours() < DIGEST_HOUR_UTC) return;

    const today = now.toISOString().slice(0, 10);
    const lastSent = await systemSettingRepository.get<string>(DIGEST_LAST_SENT_DATE_KEY);
    if (lastSent === today) return;

    const since = new Date(`${today}T00:00:00.000Z`);
    const count = await auditRepository.countSince(AUTO_STOPLISTED_AUDIT_ACTION, since);

    await systemSettingRepository.set(DIGEST_LAST_SENT_DATE_KEY, today);
    if (count === 0) return;

    await notificationService.notifySalesAutoStopListDigest(count);
  }
}

export const leadAutoStopListService = new LeadAutoStopListService();
