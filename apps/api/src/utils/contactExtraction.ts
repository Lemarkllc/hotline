/**
 * Best-effort извлечение контактов из тела письма (PLAN.md, решение №5) — дополняет
 * email/имя из заголовка From. Не блокирует создание заявки при неудаче: обе функции
 * возвращают null, если ничего похожего не нашли, а не бросают ошибку.
 */

// Разделитель — не только обычный дефис: письма (особенно скопированные из Word/PDF)
// часто используют типографские тире (en/em dash и т.п.) вместо "-".
const SEP = "[\\s.\\-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212]";
// Две альтернативы для начала номера: с кодом страны/восьмёркой (+7/8/+XX), ИЛИ без
// него, но тогда код города обязательно в скобках — так офисные номера вида
// "(499) 678-20-12" (без ведущего 8) распознаются, не порождая ложных срабатываний
// на произвольные 10-значные последовательности.
const PHONE_RE = new RegExp(
  `(?:(?:\\+7|8|\\+\\d{1,3})${SEP}?\\(?\\d{3}\\)?|\\(\\d{3}\\))${SEP}?\\d{3}${SEP}?\\d{2}${SEP}?\\d{2}\\b`,
);

export function extractPhone(text: string): string | null {
  const match = text.match(PHONE_RE);
  return match ? match[0].trim() : null;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Второй email в теле письма — например, у другого контактного лица (замдиректора,
 * секретаря и т.п.), не у самого отправителя. Для продаж это отдельный канал связи,
 * возвращаем первый адрес, отличный от email отправителя (excludeEmail). */
export function extractEmail(text: string, excludeEmail?: string | null): string | null {
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;
  const exclude = excludeEmail?.toLowerCase();
  const found = matches.find((m) => m.toLowerCase() !== exclude);
  return found ?? null;
}

/** Ищет строку-подпись вида "С уважением, Иван Иванов" / "Best regards, John" —
 * следующая непустая строка после маркера, если она короткая и не похожа на
 * email/телефон/URL. */
const SIGNATURE_MARKER_RE = /(с\s*уважением|с\s*ув\.?|best\s*regards|regards|thanks|спасибо)/i;
const LOOKS_LIKE_CONTACT_LINE_RE = /[@]|https?:\/\/|\d{5,}/;

export function extractNameFromSignature(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !SIGNATURE_MARKER_RE.test(line)) continue;

    // Иногда имя стоит на той же строке после запятой ("С уважением, Иван Иванов").
    const sameLineMatch = line.match(/,\s*(.+)$/);
    const sameLineCandidate = sameLineMatch?.[1]?.trim();
    if (sameLineCandidate && isPlausibleName(sameLineCandidate)) return sameLineCandidate;

    // Смотрим несколько следующих строк, а не только первую непустую — подпись
    // часто содержит email/телефон ДО имени или после него.
    for (let j = i + 1; j < lines.length && j <= i + 3; j += 1) {
      const candidate = lines[j];
      if (candidate && isPlausibleName(candidate)) return candidate;
    }
  }
  return null;
}

function isPlausibleName(candidate: string): boolean {
  return candidate.length > 0 && candidate.length <= 60 && !LOOKS_LIKE_CONTACT_LINE_RE.test(candidate);
}
