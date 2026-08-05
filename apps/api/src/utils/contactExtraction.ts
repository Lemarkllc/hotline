/**
 * Best-effort извлечение контактов из тела письма (PLAN.md, решение №5) — дополняет
 * email/имя из заголовка From. Не блокирует создание заявки при неудаче: обе функции
 * возвращают null, если ничего похожего не нашли, а не бросают ошибку.
 */

const PHONE_RE = /(?:\+7|8|\+\d{1,3})[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}\b/;

export function extractPhone(text: string): string | null {
  const match = text.match(PHONE_RE);
  return match ? match[0].trim() : null;
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
