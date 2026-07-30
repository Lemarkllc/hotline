import type { Channel } from "@hotline/shared";

export interface ApiClientOptions {
  baseUrl: string;
  serviceToken: string;
  channel: Channel;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Единственная точка HTTP-общения бота с backend API (архитектура §24: BOT --> API).
 * Аутентифицируется service-token'ом — бот доверенный сервис, действует от имени
 * конкретного telegramId, который передаётся явным полем в каждом запросе.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    // Без таймаута зависший запрос к API вешает разговор в боте навсегда без единой
    // ошибки в логах (не throw, а вечный await) — ставим потолок в 30 сек.
    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        "x-bot-service-token": this.options.serviceToken,
        ...extraHeaders,
      },
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      throw new ApiError(res.status, data?.message ?? `Ошибка запроса ${method} ${path}`, data?.details);
    }
    return data as T;
  }

  identifyTelegramUser(telegramId: string, fullName?: string) {
    return this.request<{ status: string; userId: string; isNew: boolean }>("POST", "/auth/telegram", {
      telegramId,
      fullName,
    });
  }

  createAppeal(input: {
    telegramId: string;
    type: string;
    mode: "OPEN" | "CONFIDENTIAL";
    originalText: string;
    attachmentIds: string[];
  }) {
    return this.request<{ id: string; publicNumber: string }>("POST", "/appeals", input);
  }

  listMyAppeals(telegramId: string, page = 1, pageSize = 5, bucket: "OPEN" | "CLOSED" = "OPEN") {
    return this.request<{ items: unknown[]; total: number }>(
      "GET",
      `/appeals/mine?telegramId=${telegramId}&page=${page}&pageSize=${pageSize}&bucket=${bucket}`,
    );
  }

  getMyAppeal(telegramId: string, id: string) {
    return this.request<Record<string, unknown>>("GET", `/appeals/mine/${id}?telegramId=${telegramId}`);
  }

  replyToClarification(telegramId: string, appealId: string, text: string) {
    return this.request<{ ok: true }>("POST", `/appeals/${appealId}/messages`, { telegramId, text });
  }

  submitRating(telegramId: string, appealId: string, score: number, comment?: string) {
    return this.request<{ ok: true }>("POST", `/appeals/${appealId}/rating`, { telegramId, score, comment });
  }

  async uploadDraftAttachment(
    telegramId: string,
    file: Blob,
    filename: string,
  ): Promise<{ id: string; count: number }> {
    const form = new FormData();
    form.append("telegramId", telegramId);
    form.append("file", file, filename);
    return this.request("POST", "/attachments", form);
  }

  removeDraftAttachment(telegramId: string, attachmentId: string) {
    return this.request<{ ok: true }>("DELETE", `/attachments/${attachmentId}`, { telegramId });
  }

  decideAccessRequest(telegramId: string, requestId: string, decision: "approve" | "reject", reason?: string) {
    return this.request<{ ok: true }>("POST", `/users/access-requests/${requestId}/${decision}-bot`, {
      telegramId,
      reason,
    });
  }

  // --- Канал CUSTOMER (Фаза 7, PLAN.md §6) — bot-customer ---

  identifyExternalContact(telegramId: string, fullName?: string, consentVersion?: string) {
    return this.request<{ contactId: string; hasConsent: boolean; isNew: boolean }>(
      "POST",
      "/auth/customer-telegram",
      { telegramId, fullName, consentVersion },
    );
  }

  createCustomerAppeal(input: { telegramId: string; type: string; mode: "OPEN" | "CONFIDENTIAL"; originalText: string }) {
    return this.request<{ id: string; publicNumber: string }>("POST", "/customer/appeals", input);
  }

  listMyCustomerAppeals(telegramId: string, page = 1, pageSize = 5, bucket: "OPEN" | "CLOSED" = "OPEN") {
    return this.request<{ items: unknown[]; total: number }>(
      "GET",
      `/customer/appeals/mine?telegramId=${telegramId}&page=${page}&pageSize=${pageSize}&bucket=${bucket}`,
    );
  }

  getMyCustomerAppeal(telegramId: string, id: string) {
    return this.request<Record<string, unknown>>("GET", `/customer/appeals/mine/${id}?telegramId=${telegramId}`);
  }

  submitCustomerRating(telegramId: string, appealId: string, wouldRecommendScore: number, wouldReturnScore: number) {
    return this.request<{ ok: true }>("POST", `/customer/appeals/${appealId}/rating`, {
      telegramId,
      wouldRecommendScore,
      wouldReturnScore,
    });
  }

  replyToCustomerAppeal(telegramId: string, appealId: string, text: string) {
    return this.request<{ ok: true }>("POST", `/customer/appeals/${appealId}/reply`, { telegramId, text });
  }

  listPendingNotifications() {
    return this.request<
      {
        id: string;
        userId: string | null;
        externalContactId: string | null;
        appealId: string | null;
        payload: Record<string, unknown>;
        user: { telegramId: string | null } | null;
        externalContact: { telegramId: string | null } | null;
      }[]
    >("GET", "/notifications/pending");
  }

  ackNotification(id: string) {
    return this.request<{ ok: true }>("POST", `/notifications/${id}/ack`);
  }
}
