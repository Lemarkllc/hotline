import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { DEFAULT_EMPLOYEE_EPICS, DEFAULT_ROLE_PERMISSIONS, ROLE_NAMES } from "@hotline/shared";

const prisma = new PrismaClient();

async function main() {
  for (const roleName of ROLE_NAMES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    for (const permission of DEFAULT_ROLE_PERMISSIONS[roleName]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permission: { roleId: role.id, permission } },
        update: {},
        create: { roleId: role.id, permission },
      });
    }
  }
  console.log(`Роли и права засеяны: ${ROLE_NAMES.join(", ")}`);

  for (const name of DEFAULT_EMPLOYEE_EPICS) {
    await prisma.epic.upsert({
      where: { channel_name: { channel: "EMPLOYEE", name } },
      update: {},
      create: { channel: "EMPLOYEE", name },
    });
  }
  console.log(`Справочник эпиков (EMPLOYEE) засеян: ${DEFAULT_EMPLOYEE_EPICS.length} шт.`);

  const bootstrapAdminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@hotline.local";
  const bootstrapAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow123!";
  const existingAdmin = await prisma.user.findUnique({ where: { email: bootstrapAdminEmail } });
  if (!existingAdmin) {
    const administratorRole = await prisma.role.findUniqueOrThrow({
      where: { name: "ADMINISTRATOR" },
    });
    const admin = await prisma.user.create({
      data: {
        email: bootstrapAdminEmail,
        fullName: "Первичный администратор",
        status: "ACTIVE",
        passwordHash: await argon2.hash(bootstrapAdminPassword, { type: argon2.argon2id }),
        mustChangePassword: true,
        userRoles: { create: { roleId: administratorRole.id } },
        channelAccess: { create: { channel: "EMPLOYEE" } },
      },
    });
    console.log(
      `Создан bootstrap-администратор: ${admin.email} / временный пароль: ${bootstrapAdminPassword} (сменить при первом входе; 2FA потребуется настроить перед полноценной работой).`,
    );
  } else {
    console.log("Bootstrap-администратор уже существует, пропускаем.");
  }

  const bootstrapHrdEmail = process.env.SEED_HRD_EMAIL ?? "hrd@hotline.local";
  const bootstrapHrdPassword = process.env.SEED_HRD_PASSWORD ?? "ChangeMeNow123!";
  const existingHrd = await prisma.user.findUnique({ where: { email: bootstrapHrdEmail } });
  if (!existingHrd) {
    const hrdRole = await prisma.role.findUniqueOrThrow({ where: { name: "HRD" } });
    const hrd = await prisma.user.create({
      data: {
        email: bootstrapHrdEmail,
        fullName: "Первичный HRD",
        status: "ACTIVE",
        passwordHash: await argon2.hash(bootstrapHrdPassword, { type: argon2.argon2id }),
        mustChangePassword: true,
        userRoles: { create: { roleId: hrdRole.id } },
        channelAccess: { create: { channel: "EMPLOYEE" } },
      },
    });
    console.log(
      `Создан bootstrap-HRD: ${hrd.email} / временный пароль: ${bootstrapHrdPassword} (сменить при первом входе).`,
    );
  } else {
    console.log("Bootstrap-HRD уже существует, пропускаем.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
