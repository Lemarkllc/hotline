import { describe, expect, it } from "vitest";
import { simpleParser } from "mailparser";
import { extractNameFromSignature, extractPhone } from "@/utils/contactExtraction.js";

describe("extractPhone", () => {
  it("находит российский номер в формате +7", () => {
    expect(extractPhone("Звоните мне +7 926 123-45-67, буду рад")).toBe("+7 926 123-45-67");
  });

  it("находит номер в формате 8(XXX)", () => {
    expect(extractPhone("Тел: 8(495)1234567")).toBe("8(495)1234567");
  });

  it("возвращает null, если телефона в тексте нет", () => {
    expect(extractPhone("Просто текст письма без контактов.")).toBeNull();
  });
});

describe("extractNameFromSignature", () => {
  it("извлекает имя после маркера 'С уважением' на следующей строке", () => {
    const body = "Добрый день!\n\nИнтересует ваше предложение.\n\nС уважением,\nИван Петров";
    expect(extractNameFromSignature(body)).toBe("Иван Петров");
  });

  it("извлекает имя на той же строке через запятую", () => {
    const body = "Здравствуйте.\n\nС уважением, Анна Смирнова";
    expect(extractNameFromSignature(body)).toBe("Анна Смирнова");
  });

  it("не путает email/телефон в подписи с именем", () => {
    const body = "Текст письма.\n\nBest regards,\ncontact@example.com\nМария Иванова";
    expect(extractNameFromSignature(body)).toBe("Мария Иванова");
  });

  it("возвращает null, если маркера подписи нет", () => {
    expect(extractNameFromSignature("Просто текст без подписи.")).toBeNull();
  });
});

describe("simpleParser (mailparser) — разбор письма для emailIngestService", () => {
  const rawMime = [
    "From: \"Иван Петров\" <ivan@example.com>",
    "To: sales@lemarkllc.ru",
    "Subject: Запрос коммерческого предложения",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Здравствуйте! Интересует ваше предложение.",
    "",
    "С уважением,",
    "Иван Петров",
    "+7 926 123-45-67",
  ].join("\r\n");

  it("извлекает email/имя из From, тему и текст письма", async () => {
    const parsed = await simpleParser(rawMime);
    expect(parsed.from?.value[0]?.address).toBe("ivan@example.com");
    expect(parsed.from?.value[0]?.name).toBe("Иван Петров");
    expect(parsed.subject).toBe("Запрос коммерческого предложения");
    expect(parsed.text).toContain("Интересует ваше предложение");
  });
});
