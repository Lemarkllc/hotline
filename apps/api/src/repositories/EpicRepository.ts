import type { Channel, Epic } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

export class EpicRepository {
  list(channel: Channel, includeInactive = false): Promise<Epic[]> {
    return prisma.epic.findMany({
      where: { channel, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string): Promise<Epic | null> {
    return prisma.epic.findUnique({ where: { id } });
  }

  create(channel: Channel, name: string): Promise<Epic> {
    return prisma.epic.create({ data: { channel, name } });
  }

  setActive(id: string, isActive: boolean): Promise<Epic> {
    return prisma.epic.update({ where: { id }, data: { isActive } });
  }

  seedDefaults(channel: Channel, names: readonly string[]): Promise<unknown> {
    return prisma.$transaction(
      names.map((name) =>
        prisma.epic.upsert({
          where: { channel_name: { channel, name } },
          update: {},
          create: { channel, name },
        }),
      ),
    );
  }
}

export const epicRepository = new EpicRepository();
