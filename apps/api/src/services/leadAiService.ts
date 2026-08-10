import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";

export interface LeadAiResult {
  isRelevant: boolean;
  reasoning: string;
  phone: string | null;
  contactEmail: string | null;
  contactName: string | null;
}

/** Модель иногда возвращает буквальную строку "null" вместо JSON null для пустых
 * необязательных полей (проверено вживую) — нормализуем, иначе интерфейс покажет
 * текст "null" вместо того, чтобы просто ничего не показать. */
function normalizeNullable(value: string | null | undefined): string | null {
  if (value == null || value.trim().toLowerCase() === "null") return null;
  return value;
}

const SYSTEM_PROMPT = `Ты помогаешь отделу продаж завода Lemark — ведущего производителя HPL-пластика (декоративный бумажно-слоистый пластик) в России — обрабатывать входящие письма на sales@lemarkllc.ru.

По тексту письма определи:
1. is_relevant — интересуется ли автор покупкой: (а) листового HPL-пластика Lemark, ИЛИ (б) готовой продукции ИЗ HPL, которую продают партнёры компании — столешницы, фасадные панели, двери, материалы для мебели. НЕ считай релевантным: спам, рассылки курсов/тренингов/семинаров, вакансии, предложения от поставщиков/подрядчиков (входящий B2B-спам), общеинформационные письма без намерения купить.
2. Извлеки контактные данные из письма, если есть: телефон, email (отличный от адреса отправителя, если в тексте указан отдельный контакт), имя контактного лица.
3. reasoning — короткое (одна фраза) объяснение вывода для проверяющего менеджера.`;

const CLASSIFY_TOOL = {
  type: "function" as const,
  name: "classify_lead",
  description: "Классификация письма и извлечение контактов",
  parameters: {
    type: "object",
    properties: {
      is_relevant: { type: "boolean" },
      reasoning: { type: "string" },
      phone: { type: ["string", "null"] },
      contact_email: { type: ["string", "null"] },
      contact_name: { type: ["string", "null"] },
    },
    required: ["is_relevant", "reasoning", "phone", "contact_email", "contact_name"],
    additionalProperties: false,
  },
};

interface YandexFunctionCallItem {
  type: "function_call";
  name: string;
  arguments: string;
}

interface YandexResponsesApiResponse {
  error?: { message?: string } | null;
  output?: Array<YandexFunctionCallItem | { type: string }>;
}

/**
 * Режим наблюдения (см. PLAN.md-обсуждение с пользователем): классифицирует новую
 * «Заявку» через Yandex AI Studio (Responses API, OpenAI-совместимый), но результат
 * только пишется на лид — поведение emailIngestService/leadService пока не меняется.
 * Best-effort: любая ошибка (нет ключа, таймаут, HTTP-ошибка, некорректный JSON)
 * возвращает null, не бросает — классификация письма не должна ронять его приём.
 */
export class LeadAiService {
  async classify(input: { subject: string; body: string; fromEmail: string }): Promise<LeadAiResult | null> {
    if (!config.yandexAi.apiKey || !config.yandexAi.folderId) return null;

    try {
      const res = await fetch("https://ai.api.cloud.yandex.net/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.yandexAi.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model: `gpt://${config.yandexAi.folderId}/${config.yandexAi.model}`,
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Тема: ${input.subject}\nОт кого: ${input.fromEmail}\n\n${input.body}` },
          ],
          tools: [CLASSIFY_TOOL],
          tool_choice: { type: "function", name: "classify_lead" },
        }),
      });

      if (!res.ok) {
        logger.error({ status: res.status, body: await res.text() }, "leadAiService: HTTP-ошибка");
        return null;
      }

      const data = (await res.json()) as YandexResponsesApiResponse;
      if (data.error) {
        logger.error({ error: data.error }, "leadAiService: ошибка API");
        return null;
      }

      const call = data.output?.find(
        (item) => item.type === "function_call" && (item as YandexFunctionCallItem).name === "classify_lead",
      ) as YandexFunctionCallItem | undefined;
      if (!call) {
        logger.error({ output: data.output }, "leadAiService: модель не вызвала classify_lead");
        return null;
      }

      const args = JSON.parse(call.arguments) as {
        is_relevant: boolean;
        reasoning: string;
        phone: string | null;
        contact_email: string | null;
        contact_name: string | null;
      };

      return {
        isRelevant: Boolean(args.is_relevant),
        reasoning: args.reasoning ?? "",
        phone: normalizeNullable(args.phone),
        contactEmail: normalizeNullable(args.contact_email),
        contactName: normalizeNullable(args.contact_name),
      };
    } catch (error) {
      logger.error({ err: error }, "leadAiService: classify упал");
      return null;
    }
  }
}

export const leadAiService = new LeadAiService();
