import { describe, expect, it } from "vitest";
import { transliterateToLogin } from "@/utils/transliterate.js";

describe("transliterateToLogin (vpnService — \"и.фамилия\" транслитом)", () => {
  it("имя + фамилия -> и.фамилия", () => {
    expect(transliterateToLogin("Иван Иванов")).toBe("i.ivanov");
  });

  it("составная фамилия -> берёт последнее слово как фамилию, дефис не переносится", () => {
    expect(transliterateToLogin("Анна Ковалёва-Петрова")).toBe("a.kovalevapetrova");
  });

  it("ё транслитерируется как e", () => {
    expect(transliterateToLogin("Пётр Ёлкин")).toBe("p.elkin");
  });

  it("ъ и ь выпадают, не переносятся в латиницу", () => {
    expect(transliterateToLogin("Пётр Подъячев")).toBe("p.podyachev");
  });

  it("одно слово (нет фамилии) -> первые две буквы", () => {
    expect(transliterateToLogin("Мадонна")).toBe("ma");
  });

  it("лишние пробелы схлопываются", () => {
    expect(transliterateToLogin("  Иван   Иванов  ")).toBe("i.ivanov");
  });

  it("пустая строка -> запасное значение, не падает", () => {
    expect(transliterateToLogin("")).toBe("user");
  });
});
