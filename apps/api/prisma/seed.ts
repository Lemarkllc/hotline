import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import {
  DEFAULT_CUSTOMER_EPICS,
  DEFAULT_EMPLOYEE_EPICS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_NAMES,
} from "@hotline/shared";

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

  for (const name of DEFAULT_CUSTOMER_EPICS) {
    await prisma.epic.upsert({
      where: { channel_name: { channel: "CUSTOMER", name } },
      update: {},
      create: { channel: "CUSTOMER", name },
    });
  }
  console.log(`Справочник эпиков (CUSTOMER) засеян: ${DEFAULT_CUSTOMER_EPICS.length} шт.`);

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

  // Фаза 7 (PLAN.md §6): в отличие от HRD/Administrator, «Продажи» получает
  // channelAccess CUSTOMER, а не EMPLOYEE — иначе роль ничего не увидит несмотря
  // на верные permission (доступ всегда дополнительно скоуплен по каналу).
  const bootstrapSalesEmail = process.env.SEED_SALES_EMAIL ?? "sales@hotline.local";
  const bootstrapSalesPassword = process.env.SEED_SALES_PASSWORD ?? "ChangeMeNow123!";
  const existingSales = await prisma.user.findUnique({ where: { email: bootstrapSalesEmail } });
  if (!existingSales) {
    const salesRole = await prisma.role.findUniqueOrThrow({ where: { name: "SALES" } });
    const sales = await prisma.user.create({
      data: {
        email: bootstrapSalesEmail,
        fullName: "Первичный менеджер продаж",
        status: "ACTIVE",
        passwordHash: await argon2.hash(bootstrapSalesPassword, { type: argon2.argon2id }),
        mustChangePassword: true,
        userRoles: { create: { roleId: salesRole.id } },
        channelAccess: { create: { channel: "CUSTOMER" } },
      },
    });
    console.log(
      `Создан bootstrap-«Продажи»: ${sales.email} / временный пароль: ${bootstrapSalesPassword} (сменить при первом входе).`,
    );
  } else {
    console.log("Bootstrap-«Продажи» уже существует, пропускаем.");
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
