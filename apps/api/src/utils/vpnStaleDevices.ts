/** Какие устройства VPN-подписки давно не обновляли подписку (см.
 * vpnService.cleanupStaleDevices). Панель сама устройства не забывает никогда, а
 * приложение обновляет подписку раз в 12 ч — устройство, молчащее дольше порога,
 * почти наверняка удалено (переход Happ → INCY, смена телефона). */
export function selectStaleDevices<T extends { lastSeen: number }>(devices: readonly T[], staleDays: number, now: number): T[] {
  const threshold = now - staleDays * 24 * 60 * 60 * 1000;
  return devices.filter((d) => d.lastSeen < threshold);
}
