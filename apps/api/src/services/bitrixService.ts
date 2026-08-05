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
}

export const bitrixService = new BitrixService();
