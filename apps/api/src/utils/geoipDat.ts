import { fromPrefix, type IpInterval } from "@/utils/cidr.js";

/** Разбор v2ray geoip.dat (protobuf) без зависимостей — нужен только список сетей
 * одной страны для AmneziaWG split-routing (utils/awgAllowedIps.ts). Схема:
 *   GeoIPList { repeated GeoIP entry = 1; }
 *   GeoIP     { string country_code = 1; repeated CIDR cidr = 2; ... }
 *   CIDR      { bytes ip = 1; uint32 prefix = 2; }
 * Остальные поля пропускаем. */

type Field = { field: number; wire: number; value: bigint | Uint8Array };

function readVarint(data: Uint8Array, offset: number): [bigint, number] {
  let value = 0n;
  let shift = 0n;
  for (;;) {
    if (offset >= data.length) throw new Error("geoip.dat: обрезанный varint");
    const byte = data[offset++]!;
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [value, offset];
    shift += 7n;
    if (shift > 70n) throw new Error("geoip.dat: слишком длинный varint");
  }
}

function* fields(data: Uint8Array): Generator<Field> {
  let offset = 0;
  while (offset < data.length) {
    const [key, afterKey] = readVarint(data, offset);
    offset = afterKey;
    const field = Number(key >> 3n);
    const wire = Number(key & 7n);
    if (field <= 0) throw new Error("geoip.dat: некорректный номер поля");
    if (wire === 0) {
      const [value, next] = readVarint(data, offset);
      offset = next;
      yield { field, wire, value };
    } else if (wire === 1 || wire === 5) {
      const size = wire === 1 ? 8 : 4;
      if (offset + size > data.length) throw new Error("geoip.dat: обрезанное fixed-поле");
      yield { field, wire, value: data.subarray(offset, offset + size) };
      offset += size;
    } else if (wire === 2) {
      const [length, next] = readVarint(data, offset);
      const end = next + Number(length);
      if (end > data.length) throw new Error("geoip.dat: обрезанное bytes-поле");
      yield { field, wire, value: data.subarray(next, end) };
      offset = end;
    } else {
      throw new Error(`geoip.dat: неподдерживаемый wire type ${wire}`);
    }
  }
}

function parseCidrMessage(message: Uint8Array): IpInterval | null {
  let ip: Uint8Array | null = null;
  let prefix: number | null = null;
  for (const f of fields(message)) {
    if (f.field === 1 && f.wire === 2) ip = f.value as Uint8Array;
    else if (f.field === 2 && f.wire === 0) prefix = Number(f.value);
  }
  if (!ip || prefix === null) return null;
  const version = ip.length === 4 ? 4 : ip.length === 16 ? 6 : null;
  if (!version || prefix > ip.length * 8) return null;
  let address = 0n;
  for (const byte of ip) address = (address << 8n) | BigInt(byte);
  return fromPrefix(version, address, prefix);
}

/** Сети страны `countryCode` (регистр не важен). Ошибка, если категории нет или
 * она пустая — вызывающий не должен молча выдать полнотуннельный конфиг. */
export function loadGeoIpCountry(data: Uint8Array, countryCode: string): IpInterval[] {
  const wanted = countryCode.trim().toUpperCase();
  for (const entry of fields(data)) {
    if (entry.field !== 1 || entry.wire !== 2) continue;
    let code: string | null = null;
    const cidrs: Uint8Array[] = [];
    for (const f of fields(entry.value as Uint8Array)) {
      if (f.field === 1 && f.wire === 2) code = Buffer.from(f.value as Uint8Array).toString("utf-8").trim().toUpperCase();
      else if (f.field === 2 && f.wire === 2) cidrs.push(f.value as Uint8Array);
    }
    if (code !== wanted) continue;
    const networks = cidrs.map(parseCidrMessage).filter((n): n is IpInterval => n !== null);
    if (networks.length === 0) throw new Error(`geoip.dat: категория ${wanted} пустая`);
    return networks;
  }
  throw new Error(`geoip.dat: категория ${wanted} не найдена`);
}
