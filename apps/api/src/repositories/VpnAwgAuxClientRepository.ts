import type { VpnAwgAuxClient } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

/** Вспомогательные AWG-клиенты слотов 2…5 (см. схему VpnAwgAuxClient,
 * vpnService.syncAwgAuxClients). */
export class VpnAwgAuxClientRepository {
  listByProfile(profileId: string): Promise<VpnAwgAuxClient[]> {
    return prisma.vpnAwgAuxClient.findMany({ where: { profileId }, orderBy: { slot: "asc" } });
  }

  findBySlot(profileId: string, slot: number): Promise<VpnAwgAuxClient | null> {
    return prisma.vpnAwgAuxClient.findUnique({ where: { profileId_slot: { profileId, slot } } });
  }

  create(data: { profileId: string; slot: number; panelEmail: string; subId: string }): Promise<VpnAwgAuxClient> {
    return prisma.vpnAwgAuxClient.create({ data });
  }

  delete(id: string): Promise<VpnAwgAuxClient> {
    return prisma.vpnAwgAuxClient.delete({ where: { id } });
  }

  deleteAllForProfile(profileId: string) {
    return prisma.vpnAwgAuxClient.deleteMany({ where: { profileId } });
  }
}

export const vpnAwgAuxClientRepository = new VpnAwgAuxClientRepository();
