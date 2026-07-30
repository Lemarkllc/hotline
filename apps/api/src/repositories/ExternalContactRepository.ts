import type { ExternalContact } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

/** "Клиент" канала CUSTOMER — без approval-флоу access_requests (Фаза 7, PLAN.md §6);
 * вместо него обязательное согласие (consentAt/consentVersion), см. authService. */
export class ExternalContactRepository {
  findByTelegramId(telegramId: bigint): Promise<ExternalContact | null> {
    return prisma.externalContact.findUnique({ where: { telegramId } });
  }

  findById(id: string): Promise<ExternalContact | null> {
    return prisma.externalContact.findUnique({ where: { id } });
  }

  /** Согласие (consentVersion) может отсутствовать при самом первом вызове — тогда
   * контакт создаётся без него, а второй вызов (после показа текста согласия боту)
   * донасыщает эти поля через тот же upsert-путь в authService. */
  create(data: { telegramId: bigint; fullName: string; consentVersion?: string }): Promise<ExternalContact> {
    return prisma.externalContact.create({
      data: {
        telegramId: data.telegramId,
        fullName: data.fullName,
        ...(data.consentVersion ? { consentAt: new Date(), consentVersion: data.consentVersion } : {}),
      },
    });
  }
}

export const externalContactRepository = new ExternalContactRepository();
