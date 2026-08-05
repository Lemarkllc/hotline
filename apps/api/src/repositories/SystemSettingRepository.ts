import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

/** Generic key-value хранилище — здесь используется под курсор IMAP-поллинга
 * (ключ "email_ingest_cursor"), но переиспользуемо для любых будущих настроек. */
export class SystemSettingRepository {
  async get<T>(key: string): Promise<T | null> {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return (row?.value as T) ?? null;
  }

  async set(key: string, value: Prisma.InputJsonValue): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

export const systemSettingRepository = new SystemSettingRepository();
