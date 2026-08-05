import { prisma } from "@/lib/prisma.js";

/** Атомарный инкремент именованного счётчика — Prisma-upsert компилируется в нативный
 * `INSERT ... ON CONFLICT` для PostgreSQL, что делает его race-safe. Используется и
 * Appeal.publicNumber (AppealRepository), и EmailLead.publicNumber (EmailLeadRepository)
 * — общий примитив, не отдельная копия логики под каждую сущность. */
export async function nextSequence(key: string): Promise<number> {
  const seq = await prisma.numberSequence.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return seq.value;
}
