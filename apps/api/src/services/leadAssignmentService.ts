import { bitrixService } from "@/services/bitrixService.js";
import {
  NEWCOMERS,
  NEW_LEAD_THRESHOLD,
  OVERFLOW,
  REST,
  SALES_ROSTER,
  type SalesRosterKey,
} from "@/config/salesRoster.js";

export interface PickedAssignee {
  bitrixId: string;
  fullName: string;
  /** Не показывается пользователю — только для аудита (auditService.record metadata),
   * чтобы при разборе ошибочного назначения было видно, какая ветка алгоритма сработала. */
  reason: string;
}

/** "Не обработан" в Bitrix — STATUS_ID="NEW" (проверено вживую через crm.status.list). */
const NEW_STATUS_ID = "NEW";

function pick(key: SalesRosterKey, reason: string): PickedAssignee {
  const person = SALES_ROSTER[key];
  return { bitrixId: person.bitrixId, fullName: person.fullName, reason };
}

/**
 * Алгоритм авто-назначения релевантного лида (решён через grill-me-сессию с
 * пользователем, PLAN.md-обсуждение не заведено — решение зафиксировано только тут
 * и в комментариях): приоритет —
 *   1. Явно упомянутый в письме менеджер (любой из ростера) — абсолютный приоритет.
 *   2. Роман/Мила (новички) — индивидуальная проверка "Не обработан" < 10 у каждого;
 *      если оба прошли порог — тому, у кого сейчас меньше (самобалансировка, ничья → Роман).
 *   3. Архипова Анастасия — тот же порог, ниже приоритетом, чем у новичков.
 *   4. Случайный выбор среди REST (сегодня — Павел/Татьяна/Александр), если и переполнение занято.
 */
export async function pickAssignee(mentionedManager: SalesRosterKey | null): Promise<PickedAssignee> {
  if (mentionedManager) {
    return pick(mentionedManager, `упомянут в письме (${mentionedManager})`);
  }

  const newcomerCounts = await Promise.all(
    NEWCOMERS.map(async (key) => ({
      key,
      count: await bitrixService.countLeadsByStatus(SALES_ROSTER[key].bitrixId, NEW_STATUS_ID),
    })),
  );
  const eligibleNewcomers = newcomerCounts.filter((c) => c.count < NEW_LEAD_THRESHOLD);
  if (eligibleNewcomers.length > 0) {
    // Самобалансировка: у кого сейчас меньше — тому и лид. Ничья (или единственный
    // прошедший порог) — берём первого в порядке NEWCOMERS (детерминированно, не важно кто).
    const chosen = eligibleNewcomers.reduce((min, c) => (c.count < min.count ? c : min));
    return pick(chosen.key, `новичок, нагрузка ${chosen.count}/${NEW_LEAD_THRESHOLD}`);
  }

  const overflowCount = await bitrixService.countLeadsByStatus(SALES_ROSTER[OVERFLOW].bitrixId, NEW_STATUS_ID);
  if (overflowCount < NEW_LEAD_THRESHOLD) {
    return pick(OVERFLOW, `переполнение, нагрузка ${overflowCount}/${NEW_LEAD_THRESHOLD}`);
  }

  const restKey = REST[Math.floor(Math.random() * REST.length)]!;
  return pick(restKey, "случайный выбор среди опытных — новички и переполнение заняты");
}
