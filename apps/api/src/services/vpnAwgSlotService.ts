import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { vpnAwgSlotRepository } from "@/repositories/VpnAwgSlotRepository.js";
import { chooseAwgSlot } from "@/utils/awgSlotChoice.js";

/** AmneziaWG для этого запроса выдать нельзя — подписка при этом рабочая
 * (vpnService.proxySubscription отдаёт её без AmneziaWG). */
export class AwgUnavailableError extends Error {}

/** Короче — не похоже на настоящий HWID приложения (как в incy_merge.py). */
const MIN_HWID_LENGTH = 6;

export class VpnAwgSlotService {
  /** Слот устройства (1..slotCount). Вызывать только после того, как панель приняла
   * основной запрос подписки с этим X-HWID — см. chooseAwgSlot. Сырой HWID не
   * сохраняется, только SHA-256. */
  async assignSlot(profileId: string, rawHwid: string | undefined, slotCount: number): Promise<number> {
    const hwid = (rawHwid ?? "").trim();
    if (hwid.length < MIN_HWID_LENGTH) throw new AwgUnavailableError("X-HWID отсутствует или слишком короткий");
    const hwidHash = createHash("sha256").update(hwid, "utf-8").digest("hex");

    for (let attempt = 1; ; attempt++) {
      try {
        const decision = await vpnAwgSlotRepository.applyDecision(profileId, hwidHash, (rows) =>
          chooseAwgSlot(rows, hwidHash, slotCount),
        );
        if (decision.kind === "unavailable") throw new AwgUnavailableError(decision.reason);
        return decision.slot;
      } catch (error) {
        const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!conflict || attempt >= 2) throw error;
      }
    }
  }
}

export const vpnAwgSlotService = new VpnAwgSlotService();
