import { PrismaClient } from "@prisma/client";
import { formatPublicNumber } from "../src/utils/appealNumber.js";

const prisma = new PrismaClient();

const EMPLOYEES = [
  { telegramId: 900001n, fullName: "Смирнова Ольга Петровна" },
  { telegramId: 900002n, fullName: "Кузнецов Дмитрий Сергеевич" },
  { telegramId: 900003n, fullName: "Волкова Анна Игоревна" },
  { telegramId: 900004n, fullName: "Соколов Артём Викторович" },
];

async function ensureEmployee(data: { telegramId: bigint; fullName: string }) {
  return prisma.user.upsert({
    where: { telegramId: data.telegramId },
    update: {},
    create: { telegramId: data.telegramId, fullName: data.fullName, status: "ACTIVE" },
  });
}

async function nextNumber(channel: "EMPLOYEE", year: number) {
  const key = `${channel}:${year}`;
  const seq = await prisma.numberSequence.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return formatPublicNumber(channel, year, seq.value);
}

async function main() {
  const year = new Date().getUTCFullYear();
  const employees = await Promise.all(EMPLOYEES.map(ensureEmployee));
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@hotline.local" } });
  const epics = await prisma.epic.findMany({ where: { channel: "EMPLOYEE" } });
  const epicByName = (name: string) => epics.find((e) => e.name === name)?.id;

  const appeals: {
    type: string;
    mode: "OPEN" | "CONFIDENTIAL";
    status: "OPEN" | "UNDER_REVIEW" | "IN_PROGRESS" | "CLOSED";
    authorIdx: number;
    text: string;
    epic?: string;
    assign?: boolean;
    rating?: number;
    ratingComment?: string;
    daysAgo: number;
  }[] = [
    {
      type: "COMPLAINT",
      mode: "OPEN",
      status: "OPEN",
      authorIdx: 0,
      text: "В цехе №2 не работает вентиляция уже вторую неделю.",
      epic: "Условия труда",
      daysAgo: 1,
    },
    {
      type: "SUGGESTION",
      mode: "OPEN",
      status: "UNDER_REVIEW",
      authorIdx: 1,
      text: "Предлагаю добавить дополнительную смену погрузчика по пятницам — очередь на складе.",
      epic: "Производственные процессы",
      daysAgo: 3,
    },
    {
      type: "VIOLATION",
      mode: "CONFIDENTIAL",
      status: "IN_PROGRESS",
      authorIdx: 2,
      text: "Замечено нарушение техники безопасности при работе с погрузчиком — без каски и жилета.",
      epic: "Безопасность и охрана труда",
      assign: true,
      daysAgo: 5,
    },
    {
      type: "QUESTION",
      mode: "OPEN",
      status: "CLOSED",
      authorIdx: 3,
      text: "Когда будет проведена индексация зарплаты в этом квартале?",
      epic: "Персонал и HR",
      assign: true,
      rating: 5,
      ratingComment: "Быстро ответили, спасибо!",
      daysAgo: 10,
    },
    {
      type: "GRATITUDE",
      mode: "OPEN",
      status: "CLOSED",
      authorIdx: 0,
      text: "Хочу поблагодарить мастера смены Иванова за помощь в решении конфликтной ситуации.",
      epic: "Корпоративная культура",
      rating: 5,
      daysAgo: 12,
    },
    {
      type: "COMPLAINT",
      mode: "CONFIDENTIAL",
      status: "CLOSED",
      authorIdx: 1,
      text: "Считаю, что распределение премий в отделе происходит несправедливо.",
      epic: "Руководство и коммуникация",
      assign: true,
      rating: 1,
      ratingComment: "Вопрос не решён, премию так и не пересмотрели.",
      daysAgo: 20,
    },
    {
      type: "COMPLAINT",
      mode: "OPEN",
      status: "UNDER_REVIEW",
      authorIdx: 2,
      text: "На складе не хватает перчаток нужного размера — выдают только большие.",
      epic: "Оборудование",
      daysAgo: 2,
    },
  ];

  for (const a of appeals) {
    const publicNumber = await nextNumber("EMPLOYEE", year);
    const createdAt = new Date(Date.now() - a.daysAgo * 24 * 60 * 60 * 1000);
    const epicId = a.epic ? epicByName(a.epic) : undefined;

    const appeal = await prisma.appeal.create({
      data: {
        channel: "EMPLOYEE",
        type: a.type,
        mode: a.mode,
        status: a.status,
        publicNumber,
        originalText: a.text,
        authorUserId: employees[a.authorIdx].id,
        epicId,
        createdAt,
        closedAt: a.status === "CLOSED" ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
      },
    });

    await prisma.appealStatusHistory.create({
      data: { appealId: appeal.id, fromStatus: null, toStatus: "OPEN", createdAt },
    });
    if (a.status !== "OPEN") {
      await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, fromStatus: "OPEN", toStatus: a.status, createdAt },
      });
    }

    if (a.assign) {
      await prisma.appealAssignment.create({ data: { appealId: appeal.id, userId: manager.id } });
    }

    if (a.status === "CLOSED") {
      await prisma.appealComment.create({
        data: {
          appealId: appeal.id,
          authorId: manager.id,
          visibility: "PUBLIC",
          text: "Вопрос рассмотрен, приняты меры.",
          isFinalAnswer: true,
        },
      });
    }

    if (a.rating) {
      await prisma.rating.create({
        data: {
          appealId: appeal.id,
          authorId: employees[a.authorIdx].id,
          score: a.rating,
          comment: a.ratingComment,
        },
      });
    }

    console.log(`Создано обращение ${publicNumber} (${a.type}, ${a.status}, ${a.mode})`);
  }

  console.log(`Готово: ${appeals.length} демо-обращений, ${employees.length} демо-сотрудников.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
