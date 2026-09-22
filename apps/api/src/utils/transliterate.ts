const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translitWord(word: string): string {
  return word
    .toLowerCase()
    .split("")
    .map((ch) => RU_TO_LAT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

/** "Иван Иванов" -> "i.ivanov" (VPN-профиль, vpnService.ts — тот же формат, что и
 * ручные записи в панели: и.фамилия, решение пользователя 2026-09-22). Не
 * ISO 9/ГОСТ-транслитерация — практическая, читаемая, тем же принципом, что и
 * остальные "для людей" идентификаторы в этой кодовой базе (publicNumber и т.п.).
 * Одно слово в имени (нет фамилии/пробела) — используются первые две буквы вместо
 * инициала, чтобы не потерять уникальность на коротких именах. */
export function transliterateToLogin(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "user";
  if (parts.length === 1) {
    const word = translitWord(parts[0]!);
    return word.slice(0, 2) || "user";
  }
  const [first, ...rest] = parts;
  const initial = translitWord(first!).slice(0, 1);
  const surname = translitWord(rest[rest.length - 1]!);
  return `${initial}.${surname}` || "user";
}
