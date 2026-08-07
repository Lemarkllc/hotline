import { prisma } from "@/lib/prisma.js";

/** Адреса из "Заявка → В стоп-лист" — письма с этих адресов больше не создают
 * EmailLead вообще, см. emailIngestService (PLAN.md, решение №6). */
export class EmailBlocklistRepository {
  async isBlocked(email: string): Promise<boolean> {
    const entry = await prisma.emailBlocklistEntry.findUnique({ where: { email } });
    return entry !== null;
  }

  /** Идемпотентно — повторная блокировка того же адреса (например, стоп-лист на
   * второй его заявке) не должна падать на unique-конфликте. */
  add(email: string, reason: string | undefined, createdByUserId: string): Promise<unknown> {
    return prisma.emailBlocklistEntry.upsert({
      where: { email },
      update: {},
      create: { email, reason, createdByUserId },
    });
  }

  /** Обратное действие к add() — заявку вернули из стоп-листа в работу, будущие
   * письма с этого адреса снова должны создавать/дополнять заявки. deleteMany,
   * не delete — идемпотентно, не падает, если записи уже нет. */
  remove(email: string): Promise<unknown> {
    return prisma.emailBlocklistEntry.deleteMany({ where: { email } });
  }
}

export const emailBlocklistRepository = new EmailBlocklistRepository();
