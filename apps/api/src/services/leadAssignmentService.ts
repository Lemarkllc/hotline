import { bitrixService } from "@/services/bitrixService.js";
import { NEWCOMERS, NEW_LEAD_THRESHOLD, REST, SALES_ROSTER, type SalesRosterKey } from "@/config/salesRoster.js";

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
 * и в комментариях; тир "переполнение" убран 2026-09-17 — Мила уволилась, Архипова
 * заняла её место в приоритетной паре, отдельный нижний тир стал бы пустым):
 * приоритет —
 *   1. Явно упомянутый в письме менеджер (любой из ростера) — абсолютный приоритет.
 *   2. Архипова/Роман (приоритетная пара) — индивидуальная проверка "Не обработан" < 10
 *      у каждого; если оба прошли порог — тому, у кого сейчас меньше (самобалансировка,
 *      ничья → Архипова, см. порядок NEWCOMERS в salesRoster.ts).
 *   3. Случайный выбор среди REST (сегодня — Павел/Татьяна/Александр), если и
 *      приоритетная пара занята.
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
    // прошедший порог) — берём первого в порядке NEWCOMERS, то есть Архипову.
    const chosen = eligibleNewcomers.reduce((min, c) => (c.count < min.count ? c : min));
    return pick(chosen.key, `приоритетная пара, нагрузка ${chosen.count}/${NEW_LEAD_THRESHOLD}`);
  }

  const restKey = REST[Math.floor(Math.random() * REST.length)]!;
  return pick(restKey, "случайный выбор среди опытных — приоритетная пара занята");
}
