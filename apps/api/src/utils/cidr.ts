/** Минимальная CIDR-арифметика для раздельной маршрутизации AmneziaWG
 * (utils/awgAllowedIps.ts): слияние, дополнение до всего адресного пространства,
 * обратное разложение интервала на CIDR. Адреса — bigint, чтобы IPv4 и IPv6 шли
 * одним кодом. Своя реализация вместо библиотеки: нужно только это (~100 строк),
 * а граничные случаи всё равно покрываем своими тестами (awgAllowedIps.test.ts). */

export type IpVersion = 4 | 6;

export interface IpInterval {
  version: IpVersion;
  start: bigint;
  end: bigint;
}

const BITS: Record<IpVersion, number> = { 4: 32, 6: 128 };

export function maxAddress(version: IpVersion): bigint {
  return (1n << BigInt(BITS[version])) - 1n;
}

function parseIpv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

function parseIpv6(text: string): bigint | null {
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

/** "10.0.0.0/8", "fc00::/7", "1.2.3.4" (= /32) → интервал; хостовые биты обнуляются. */
export function parseCidr(text: string): IpInterval {
  const [addr, prefixText] = text.trim().split("/");
  const version: IpVersion = addr!.includes(":") ? 6 : 4;
  const base = version === 4 ? parseIpv4(addr!) : parseIpv6(addr!);
  const bits = BITS[version];
  const prefix = prefixText === undefined ? bits : Number(prefixText);
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > bits) {
    throw new Error(`некорректный CIDR: ${text}`);
  }
  return fromPrefix(version, base, prefix);
}

export function fromPrefix(version: IpVersion, address: bigint, prefix: number): IpInterval {
  const hostBits = BigInt(BITS[version] - prefix);
  const start = (address >> hostBits) << hostBits;
  return { version, start, end: start + (1n << hostBits) - 1n };
}

/** Сортирует и склеивает пересекающиеся/смежные интервалы одной версии. */
export function mergeIntervals(intervals: IpInterval[]): IpInterval[] {
  const sorted = [...intervals].sort((a, b) =>
    a.version !== b.version ? a.version - b.version : a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
  );
  const result: IpInterval[] = [];
  for (const item of sorted) {
    const last = result[result.length - 1];
    if (last && last.version === item.version && item.start <= last.end + 1n) {
      if (item.end > last.end) last.end = item.end;
    } else {
      result.push({ ...item });
    }
  }
  return result;
}

/** Всё адресное пространство версии минус переданные интервалы. */
export function complement(excluded: IpInterval[], version: IpVersion): IpInterval[] {
  const merged = mergeIntervals(excluded.filter((i) => i.version === version));
  const max = maxAddress(version);
  const result: IpInterval[] = [];
  let cursor = 0n;
  for (const item of merged) {
    if (cursor < item.start) result.push({ version, start: cursor, end: item.start - 1n });
    cursor = item.end + 1n;
  }
  if (cursor <= max) result.push({ version, start: cursor, end: max });
  return result;
}

function formatAddress(version: IpVersion, value: bigint): string {
  if (version === 4) {
    return [24n, 16n, 8n, 0n].map((shift) => ((value >> shift) & 255n).toString()).join(".");
  }
  const groups: string[] = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) groups.push(((value >> shift) & 0xffffn).toString(16));
  // Самая длинная серия нулей (≥2) сворачивается в "::" — канонический вид.
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") { i++; continue; }
    let j = i;
    while (j < 8 && groups[j] === "0") j++;
    if (j - i > bestLen && j - i >= 2) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  if (bestStart === -1) return groups.join(":");
  return `${groups.slice(0, bestStart).join(":")}::${groups.slice(bestStart + bestLen).join(":")}`;
}

/** Разлагает интервал на минимальный набор CIDR. */
export function intervalToCidrs(interval: IpInterval): string[] {
  const bits = BigInt(BITS[interval.version]);
  const result: string[] = [];
  let start = interval.start;
  while (start <= interval.end) {
    let hostBits = 0n;
    while (hostBits < bits) {
      const next = hostBits + 1n;
      const aligned = (start & ((1n << next) - 1n)) === 0n;
      if (!aligned || start + (1n << next) - 1n > interval.end) break;
      hostBits = next;
    }
    result.push(`${formatAddress(interval.version, start)}/${bits - hostBits}`);
    start += 1n << hostBits;
  }
  return result;
}
