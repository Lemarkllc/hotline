import {
  complement,
  fromPrefix,
  intervalToCidrs,
  mergeIntervals,
  parseCidr,
  type IpInterval,
} from "@/utils/cidr.js";

/** AllowedIPs для AmneziaWG «RU напрямую» (перенесено из incy_merge.py, см.
 * config/vpnConfig.ts): в туннель идёт всё, КРОМЕ российских сетей и локальных/
 * корпоративных «напрямую»; принудительные сети (Telegram и т.п.) возвращаются в
 * туннель даже внутри укрупнённой RU /19. Публичный IPv6 целиком в туннеле —
 * RU-сети IPv6 сознательно не вычитаем, иначе IPv6-трафик утекал бы мимо VPN. */
export interface AwgAllowedIpsInput {
  ruNetworks: IpInterval[];
  directCidrs: readonly string[];
  forceTunnelCidrs: readonly string[];
  ipv4CompactPrefix: number;
  maxRoutes: number;
}

export function computeAwgAllowedIps(input: AwgAllowedIpsInput): string[] {
  const direct = input.directCidrs.map(parseCidr);
  const force = input.forceTunnelCidrs.map(parseCidr);

  const ruIpv4 = input.ruNetworks
    .filter((n) => n.version === 4)
    .map((n) => {
      const prefix = 32 - bitLength(n.end - n.start + 1n) + 1;
      return prefix > input.ipv4CompactPrefix ? fromPrefix(4, n.start, input.ipv4CompactPrefix) : n;
    });

  const allowedV4 = mergeIntervals([
    ...complement([...ruIpv4, ...direct.filter((n) => n.version === 4)], 4),
    ...force.filter((n) => n.version === 4),
  ]);
  const allowedV6 = mergeIntervals([
    ...complement(direct.filter((n) => n.version === 6), 6),
    ...force.filter((n) => n.version === 6),
  ]);

  const result = [...allowedV4, ...allowedV6].flatMap(intervalToCidrs);
  if (result.length === 0) throw new Error("AllowedIPs для AmneziaWG получился пустым");
  if (result.length > input.maxRoutes) {
    throw new Error(`AllowedIPs для AmneziaWG слишком длинный: ${result.length} > ${input.maxRoutes}`);
  }
  return result;
}

/** Длина числа в битах (для размера блока 2^k → k+1). */
function bitLength(value: bigint): number {
  return value.toString(2).length;
}

/** Заменяет единственную строку AllowedIPs в конфиге. Не одна строка — ошибка:
 * конфиг неожиданного формата не выдаём, а не подставляем наугад. */
export function applyAllowedIps(conf: string, allowedIps: readonly string[]): string {
  const pattern = /^(\s*AllowedIPs\s*=\s*).*$/gim;
  const matches = conf.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(`в конфиге AmneziaWG должна быть ровно одна строка AllowedIPs (найдено ${matches.length})`);
  }
  return conf.replace(pattern, (_line, prefix: string) => `${prefix}${allowedIps.join(", ")}`);
}
