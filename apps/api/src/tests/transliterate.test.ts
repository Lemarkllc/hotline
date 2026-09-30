import { describe, expect, it } from "vitest";
import { transliterateToLogin } from "@/utils/transliterate.js";

describe("transliterateToLogin (vpnService — \"и.фамилия\" транслитом, fullName = \"Фамилия Имя [Отчество]\")", () => {
  it("фамилия + имя + отчество -> и.фамилия", () => {
    expect(transliterateToLogin("Иванов Иван Иванович")).toBe("i.ivanov");
  });

  it("фамилия + имя -> и.фамилия", () => {
    expect(transliterateToLogin("Фазилов Александр")).toBe("a.fazilov");
  });

  it("реальный случай коллизии: разные фамилии с одним отчеством дают разные логины", () => {
    expect(transliterateToLogin("Комлик Виктория Юрьевна")).toBe("v.komlik");
    expect(transliterateToLogin("Кохштейн Татьяна Юрьевна")).toBe("t.kohshteyn");
  });

  it("составная фамилия -> дефис не переносится", () => {
    expect(transliterateToLogin("Ковалёва-Петрова Анна")).toBe("a.kovalevapetrova");
  });

  it("ё транслитерируется как e", () => {
    expect(transliterateToLogin("Ёлкин Пётр")).toBe("p.elkin");
  });

  it("ъ и ь выпадают, не переносятся в латиницу", () => {
    expect(transliterateToLogin("Подъячев Пётр")).toBe("p.podyachev");
  });

  it("одно слово (нет фамилии) -> первые две буквы", () => {
    expect(transliterateToLogin("Мадонна")).toBe("ma");
  });

  it("лишние пробелы схлопываются", () => {
    expect(transliterateToLogin("  Иванов   Иван  ")).toBe("i.ivanov");
  });

  it("пустая строка -> запасное значение, не падает", () => {
    expect(transliterateToLogin("")).toBe("user");
  });
});
