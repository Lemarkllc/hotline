import type { Prisma, User } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/index.js";
import { prisma } from "@/lib/prisma.js";

export class UserRepository {
  findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByIdWithRoles(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });
  }

  findByTelegramId(telegramId: bigint): Promise<User | null> {
    return prisma.user.findFirst({ where: { telegramId, deletedAt: null } });
  }

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  createEmployeeCandidate(data: { telegramId: bigint; fullName: string }): Promise<User> {
    return prisma.user.create({
      data: {
        telegramId: data.telegramId,
        fullName: data.fullName,
        status: "PENDING",
      },
    });
  }

  createWebAccount(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    roleNames: string[];
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        status: "ACTIVE",
        mustChangePassword: true,
        userRoles: {
          create: data.roleNames.map((name) => ({ role: { connect: { name } } })),
        },
      },
    });
  }

  updateStatus(id: string, status: Prisma.UserUpdateInput["status"]): Promise<User> {
    return prisma.user.update({ where: { id }, data: { status } });
  }

  setPrivacyAccepted(id: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { privacyAcceptedAt: new Date() } });
  }

  blockUser(id: string, reason: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { status: "BLOCKED", blockReason: reason } });
  }

  unblockUser(id: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { status: "ACTIVE", blockReason: null } });
  }

  archiveUser(id: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  grantChannelAccess(userId: string, channel: string, grantedBy: string): Promise<unknown> {
    return prisma.userChannelAccess.upsert({
      where: { userId_channel: { userId, channel: channel as never } },
      update: {},
      create: { userId, channel: channel as never, grantedBy },
    });
  }

  setPassword(id: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  /** Сброс администратором — в отличие от setPassword (смена самим пользователем),
   * принудительно требует смены при следующем входе. */
  resetPassword(id: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
  }

  updateProfile(id: string, data: { fullName?: string; telegramId?: bigint | null }): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  /** Полная замена набора ролей (SRS §4.5 "Управлять ролями"). */
  async setRoles(id: string, roleNames: string[]): Promise<void> {
    const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userRole.createMany({
        data: roles.map((role) => ({ userId: id, roleId: role.id })),
      }),
    ]);
  }

  setTotpSecret(id: string, totpSecret: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { totpSecret, totpEnabled: false } });
  }

  enableTotp(id: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { totpEnabled: true } });
  }

  /** Используется notificationService, чтобы найти получателей (например, всех HRD канала). */
  findByRoleAndChannel(roleName: string, channel: string): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        userRoles: { some: { role: { name: roleName } } },
        channelAccess: { some: { channel: channel as never } },
      },
    });
  }

  /** Без фильтра по каналу — для получателей, чьё право не канало-скоуплено
   * (lead.manage у "Заявок", см. PLAN.md: "не канало-скоуплен... EmailLead не
   * имеет поля channel вообще"). findByRoleAndChannel тут не подходит: не у
   * каждого SALES гарантированно есть grant на канал CUSTOMER. */
  findByRole(roleName: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE", userRoles: { some: { role: { name: roleName } } } },
    });
  }

  list(status?: string) {
    return prisma.user.findMany({
      where: { deletedAt: null, ...(status ? { status: status as never } : {}) },
      include: { userRoles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Собирает роли, permissions и доступные каналы пользователя за один запрос. */
  async getAuthContext(userId: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        userRoles: { include: { role: { include: { permissions: true } } } },
        channelAccess: true,
      },
    });
    if (!user) return null;

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => ur.role.permissions.map((p) => p.permission))),
    ) as AuthenticatedUser["permissions"];
    const channels = user.channelAccess.map((c) => c.channel) as AuthenticatedUser["channels"];

    return { id: user.id, fullName: user.fullName, email: user.email, roleNames, permissions, channels };
  }
}

export const userRepository = new UserRepository();
