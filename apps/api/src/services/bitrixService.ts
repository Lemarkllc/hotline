import { config } from "@/config/unifiedConfig.js";
import { ValidationError } from "@/types/index.js";

export interface BitrixUserDTO {
  id: string;
  fullName: string;
  email: string | null;
}

interface BitrixApiResponse<T> {
  result?: T;
  error?: string;
  error_description?: string;
}

interface BitrixRawUser {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  EMAIL?: string;
  ACTIVE?: boolean;
}

/** Тонкая обёртка над Bitrix24 REST через входящий вебхук (PLAN.md, проверен вживую
 * 2026-08-03: user.current/crm.lead.fields/user.search/crm.status.list). Никакого SDK
 * или OAuth-флоу — токен уже встроен в сам webhookUrl. */
export class BitrixService {
  private async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!config.bitrix.webhookUrl) {
      throw new ValidationError("Bitrix24 вебхук не настроен (BITRIX_WEBHOOK_URL)");
    }
    const url = `${config.bitrix.webhookUrl.replace(/\/$/, "")}/${method}.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as BitrixApiResponse<T>;
    if (data.error) {
      throw new ValidationError(`Bitrix24 (${method}): ${data.error_description ?? data.error}`);
    }
    return data.result as T;
  }

  /**
   * Без локального кэширования (PLAN.md, решение №9 — у компании десятки
   * пользователей, не тысячи): каждый раз забираем активных сотрудников Bitrix и
   * фильтруем по подстроке на стороне API — надёжнее, чем полагаться на синтаксис
   * LIKE-фильтров Bitrix (%FIELD), который не проверялся вживую.
   */
  async searchUsers(query: string): Promise<BitrixUserDTO[]> {
    const users = await this.call<BitrixRawUser[]>("user.search", { FILTER: { ACTIVE: true } });
    const needle = query.trim().toLowerCase();
    return users
      .map((u) => ({
        id: u.ID,
        fullName: [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(" ") || u.EMAIL || u.ID,
        email: u.EMAIL ?? null,
      }))
      .filter((u) => !needle || u.fullName.toLowerCase().includes(needle) || u.email?.toLowerCase().includes(needle))
      .slice(0, 20);
  }

  /** SOURCE_ID: "EMAIL" — встроенное системное значение Bitrix ("Электронная почта",
   * проверено вживую через crm.status.list, PLAN.md решение №8), не заводим свой. */
  async createLead(input: {
    title: string;
    email: string;
    phone?: string | null;
    comments: string;
    assignedByUserId: string;
  }): Promise<string> {
    const fields: Record<string, unknown> = {
      TITLE: input.title,
      SOURCE_ID: "EMAIL",
      COMMENTS: input.comments,
      ASSIGNED_BY_ID: input.assignedByUserId,
      EMAIL: [{ VALUE: input.email, VALUE_TYPE: "WORK" }],
    };
    if (input.phone) {
      fields.PHONE = [{ VALUE: input.phone, VALUE_TYPE: "WORK" }];
    }
    const leadId = await this.call<number>("crm.lead.add", { fields });
    return String(leadId);
  }

  /**
   * "Дело" на созвон с клиентом, дедлайн — час от создания. Проверено вживую
   * (2026-08-07): нужен именно crm.activity.add (scope "crm", уже есть) —
   * tasks.task.add отдаёт insufficient_scope (нужен отдельный scope "task", его
   * пока нет). TYPE_ID=2 (звонок) + DIRECTION=2 (исходящий) требуют непустой
   * COMMUNICATIONS с телефоном — без него Bitrix отвечает "COMMUNICATIONS is not
   * defined or invalid", поэтому вызывающая сторона (leadService) не зовёт этот
   * метод, если у лида нет extractedPhone.
   *
   * ВАЖНО про DEADLINE (проверено вживую дважды, второй раз — по факту в UI
   * Bitrix, не только по ответу API): для звонка (TYPE_ID=2) Bitrix САМ
   * синхронизирует DEADLINE со START_TIME, что бы ни прислать в самом DEADLINE —
   * то, что показывается в интерфейсе как "Сделать до", это START_TIME, а не
   * END_TIME (первая версия этого метода ошибочно считала наоборот). Поэтому
   * "звонок через час" моделируется как "звонок ЗАПЛАНИРОВАН через час", а не
   * "начинается сейчас, час длится" — START_TIME/END_TIME/DEADLINE все втроём
   * выставляются на +1 час.
   */
  async createCallActivity(input: {
    leadId: string;
    phone: string;
    responsibleUserId: string;
    subject: string;
  }): Promise<void> {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await this.call("crm.activity.add", {
      fields: {
        OWNER_TYPE_ID: 1, // CRM_OWNER_TYPE_LEAD
        OWNER_ID: input.leadId,
        TYPE_ID: 2, // звонок
        DIRECTION: 2, // исходящий
        SUBJECT: input.subject,
        RESPONSIBLE_ID: input.responsibleUserId,
        COMPLETED: "N",
        START_TIME: deadline,
        END_TIME: deadline,
        DEADLINE: deadline,
        COMMUNICATIONS: [
          { VALUE: input.phone, TYPE: "PHONE", ENTITY_ID: input.leadId, ENTITY_TYPE_ID: 1 },
        ],
      },
    });
  }

  /**
   * Файлы из письма клиента — в таймлайн лида (комментарий с вложениями), не в
   * само CRM-поле лида: у лида нет универсального "файлового" поля из коробки,
   * а crm.timeline.comment.add — штатный, документированный способ прикрепить
   * произвольные файлы к CRM-сущности. Проверено вживую (2026-08-07, реальный
   * лид в проде, файл появился в таймлайне с превью — оставлен пользователю на
   * ручную проверку, не удалён скриптом).
   */
  async attachFilesToLead(
    leadId: string,
    files: { filename: string; base64Content: string }[],
    comment: string,
  ): Promise<void> {
    await this.call("crm.timeline.comment.add", {
      fields: {
        ENTITY_ID: leadId,
        ENTITY_TYPE: "lead",
        COMMENT: comment,
        FILES: files.map((f) => [f.filename, f.base64Content]),
      },
    });
  }
}

export const bitrixService = new BitrixService();
