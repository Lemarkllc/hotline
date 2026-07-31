import {
  APPEAL_STATUS_TRANSITIONS,
  EMPLOYEE_APPEAL_TYPES,
  type AppealMode,
  type AppealStatus,
  type Channel,
  type ResignationOutcome,
} from "@hotline/shared";
import {
  appealRepository,
  type AppealListFilters,
  type AppealWithDetails,
} from "@/repositories/AppealRepository.js";
import { externalContactRepository } from "@/repositories/ExternalContactRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { getPresignedDownloadUrl } from "@/lib/storage.js";
import { auditService } from "@/services/auditService.js";
import { authService } from "@/services/authService.js";
import { notificationService } from "@/services/notificationService.js";
import { userService } from "@/services/userService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/types/index.js";
import { canRevealAuthor, canSeeAuthor, hasChannelPermission } from "@/utils/authz.js";

export interface AppealDTO {
  id: string;
  publicNumber: string;
  channel: Channel;
  type: string;
  mode: AppealMode;
  status: AppealStatus;
  /** Только type="RESIGNATION" — исход закрытия (см. Appeal.resignationOutcome). */
  resignationOutcome: ResignationOutcome | null;
  epic: { id: string; name: string } | null;
  originalText: string;
  workingEdit: string | null;
  author: { id: string; fullName: string } | null;
  isAuthorHidden: boolean;
  /** true — можно кликнуть "раскрыть автора" (запросит пароль повторно, POST
   * /appeals/:id/reveal-author). Значимо только при isAuthorHidden && mode==CONFIDENTIAL;
   * для остальных ролей просто false, чтобы фронт не рисовал кликабельный элемент. */
  canRevealAuthor: boolean;
  assignees: { id: string; fullName: string }[];
  attachmentsCount: number;
  attachments: { id: string; kind: string; mimeType: string; fileSize: number; createdAt: Date }[];
  comments: {
    id: string;
    authorId: string;
    authorFullName: string;
    visibility: string;
    text: string;
    isFinalAnswer: boolean;
    createdAt: Date;
  }[];
  /** fromFullName — только при fromHrd (кто из персонала написал); при !fromHrd
   * отправитель — сам автор обращения, см. author/externalContact на самом AppealDTO. */
  messages: { id: string; fromHrd: boolean; fromFullName: string | null; text: string; createdAt: Date }[];
  statusHistory: { fromStatus: string | null; toStatus: string; createdAt: Date }[];
  /** score/comment — EMPLOYEE; wouldRecommendScore/wouldReturnScore — CUSTOMER (Фаза 7,
   * PLAN.md §6, NPS-style). Ровно одна пара заполнена в зависимости от appeal.channel. */
  rating: {
    score: number | null;
    comment: string | null;
    wouldRecommendScore: number | null;
    wouldReturnScore: number | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  reopenDeadlineAt: Date | null;
  /** Непрочитанные WEB-уведомления по этому обращению для текущего пользователя
   * (реально — ответы автора, см. notifyHrdAuthorReplied). Считается только в list()
   * (Реестр/Kanban); при открытии карточки (getByIdForStaff) сбрасывается в 0, так что
   * тут всегда 0 и это не бага. Источник — таблица Notification, отдельного поля
   * "прочитано" на самом AppealMessage нет и не нужно заводить. */
  unreadCount: number;
  /** Точки на вкладках "Переписка"/"Внутренняя работа" — что именно нового было при
   * открытии карточки (в отличие от unreadCount, который считается только в list()).
   * Заполняется один раз, из снапшота ДО того, как getByIdForStaff пометит всё
   * прочитанным — иначе к моменту сериализации уже нечего было бы показать. */
  unreadTabs: { messages: boolean; internal: boolean };
}

export class AppealService {
  private async assertActiveEmployee(telegramId: bigint) {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user || user.status !== "ACTIVE") {
      throw new ForbiddenError("Обращение может создать только подтверждённый сотрудник");
    }
    return user;
  }

  async createEmployeeAppeal(input: {
    telegramId: bigint;
    type: (typeof EMPLOYEE_APPEAL_TYPES)[number];
    mode: AppealMode;
    originalText: string;
    attachmentIds: string[];
  }) {
    const user = await this.assertActiveEmployee(input.telegramId);
    const appeal = await appealRepository.create({
      channel: "EMPLOYEE",
      type: input.type,
      mode: input.mode,
      originalText: input.originalText,
      authorUserId: user.id,
      attachmentIds: input.attachmentIds,
    });
    await notificationService.notifyHrdNewAppeal(appeal.id);
    return appeal;
  }

  async getByIdForStaff(user: AuthenticatedUser, id: string): Promise<AppealDTO> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    // Снимок ДО пометки прочитанным — иначе к моменту сериализации уже нечего
    // было бы показать в unreadTabs (см. AppealDTO.unreadTabs).
    const pendingTypes = await notificationService.pendingTypesForAppeal(user.id, id);
    // Открытие карточки = "прочитано", как в мессенджере — гасит и бейдж на
    // карточке/в реестре, и соответствующие пункты в колокольчике (общий источник).
    await notificationService.markAppealRead(user.id, id);
    const dto = this.serializeForStaff(appeal, user);
    dto.unreadTabs = {
      messages: pendingTypes.includes("author_replied"),
      internal: pendingTypes.includes("internal_mention"),
    };
    return dto;
  }

  async getByIdForAuthor(telegramId: bigint, id: string): Promise<AppealDTO> {
    const user = await this.assertActiveEmployee(telegramId);
    const appeal = await appealRepository.findById(id);
    if (!appeal || appeal.authorUserId !== user.id) {
      throw new NotFoundError("Обращение не найдено");
    }
    return this.serializeForAuthor(appeal);
  }

  async list(
    user: AuthenticatedUser,
    filters: Omit<AppealListFilters, "assigneeId" | "authorUserId"> & { mineOnly?: boolean },
  ): Promise<{ items: AppealDTO[]; total: number }> {
    const canReadAll = hasChannelPermission(user, "appeal.read_all", filters.channel);
    const canReadAssigned = hasChannelPermission(user, "appeal.read_assigned", filters.channel);
    if (!canReadAll && !canReadAssigned) {
      throw new ForbiddenError("Недостаточно прав для просмотра обращений");
    }

    const scoped: AppealListFilters = { ...filters };
    if (!canReadAll || filters.mineOnly) {
      scoped.assigneeId = user.id;
    }

    const { items, total } = await appealRepository.list(scoped);
    const dtos = items.map((a) => this.serializeForStaff(a, user));
    const unreadCounts = await notificationService.unreadCountsByAppeal(
      user.id,
      dtos.map((d) => d.id),
    );
    for (const dto of dtos) dto.unreadCount = unreadCounts.get(dto.id) ?? 0;
    return { items: dtos, total };
  }

  /** bucket: "OPEN" — всё, кроме CLOSED; "CLOSED" — только закрытые (бот делит список
   * на две вкладки вместо одного общего списка). */
  async listMineForAuthor(telegramId: bigint, page: number, pageSize: number, bucket: "OPEN" | "CLOSED") {
    const user = await this.assertActiveEmployee(telegramId);
    const { items, total } = await appealRepository.list({
      channel: "EMPLOYEE",
      authorUserId: user.id,
      ...(bucket === "CLOSED" ? { status: "CLOSED" } : { excludeStatus: "CLOSED" }),
      page,
      pageSize,
    });
    return { items: items.map((a) => this.serializeForAuthor(a)), total };
  }

  async changeStatus(
    user: AuthenticatedUser,
    id: string,
    toStatus: AppealStatus,
    reason: string | undefined,
    finalAnswer: string | undefined,
    resignationOutcome: ResignationOutcome | undefined,
  ): Promise<AppealDTO> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    if (!hasChannelPermission(user, "appeal.close", appeal.channel) &&
        !hasChannelPermission(user, "appeal.assign", appeal.channel)) {
      throw new ForbiddenError("Недостаточно прав для смены статуса");
    }

    const allowed = APPEAL_STATUS_TRANSITIONS[appeal.status].includes(toStatus);
    if (!allowed) {
      throw new ConflictError(`Переход из ${appeal.status} в ${toStatus} недопустим`);
    }

    if (toStatus === "CLOSED") {
      if (!hasChannelPermission(user, "appeal.close", appeal.channel)) {
        throw new ForbiddenError("Недостаточно прав для закрытия обращения");
      }
      if (!finalAnswer?.trim()) {
        throw new ValidationError("Закрытие требует итогового ответа (FR-WF-005)");
      }
      // Заявление на увольнение — не общий статус, а исход внутри CLOSED (см. PLAN.md
      // "Заявление на увольнение"): без выбора "Уволить"/"Отозвано" непонятно, нужно ли
      // автоматически блокировать сотрудника ниже.
      if (appeal.type === "RESIGNATION" && !resignationOutcome) {
        throw new ValidationError("Закрытие заявления на увольнение требует выбора исхода");
      }
      await appealRepository.addComment({
        appealId: id,
        authorId: user.id,
        visibility: "PUBLIC",
        text: finalAnswer,
        isFinalAnswer: true,
      });
      await appealRepository.addMessage(id, true, finalAnswer, user.id);
    }

    if (appeal.status === "CLOSED" && toStatus === "IN_PROGRESS" && !reason?.trim()) {
      throw new ValidationError("Повторное открытие требует причины (FR-WF-006)");
    }

    // Реоткрытие сбрасывает исход — он больше не финальный. Сотрудника, уже
    // заблокированного при исходе TERMINATED, обратно НЕ разблокируем автоматически:
    // осознанная асимметрия, разблокировка — отдельное ручное решение (страница
    // "Пользователи"), а не побочный эффект реоткрытия обращения.
    const nextResignationOutcome =
      appeal.type === "RESIGNATION" && appeal.status === "CLOSED" && toStatus === "IN_PROGRESS"
        ? null
        : toStatus === "CLOSED"
          ? (resignationOutcome ?? null)
          : undefined;

    await appealRepository.changeStatus(id, toStatus, user.id, reason, nextResignationOutcome);
    await notificationService.notifyStatusChanged(id, toStatus, toStatus === "CLOSED" ? finalAnswer : undefined);

    if (toStatus === "CLOSED" && appeal.type === "RESIGNATION" && resignationOutcome === "TERMINATED") {
      // appeal.authorUserId гарантированно есть — RESIGNATION существует только на
      // канале EMPLOYEE, где автор всегда User (никогда ExternalContact).
      await userService.blockUser(user, appeal.authorUserId!, `Уволен(а) по заявлению ${appeal.publicNumber}`);
    }

    const updated = await appealRepository.findById(id);
    return this.serializeForStaff(updated!, user);
  }

  async assign(user: AuthenticatedUser, id: string, assigneeUserId: string): Promise<AppealDTO> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    if (!hasChannelPermission(user, "appeal.assign", appeal.channel)) {
      throw new ForbiddenError("Недостаточно прав для назначения");
    }
    await appealRepository.assign(id, assigneeUserId);
    if (appeal.status === "OPEN") {
      await appealRepository.changeStatus(id, "UNDER_REVIEW", user.id);
    }
    await notificationService.notifyAssigned(id, assigneeUserId);
    const updated = await appealRepository.findById(id);
    return this.serializeForStaff(updated!, user);
  }

  async setWorkingEdit(user: AuthenticatedUser, id: string, text: string): Promise<AppealDTO> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    if (!hasChannelPermission(user, "appeal.read_author", appeal.channel)) {
      throw new ForbiddenError("Рабочую редакцию может создавать только HRD");
    }
    await appealRepository.setWorkingEdit(id, text);
    const updated = await appealRepository.findById(id);
    return this.serializeForStaff(updated!, user);
  }

  async setEpic(user: AuthenticatedUser, id: string, epicId: string | null): Promise<AppealDTO> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    if (!hasChannelPermission(user, "appeal.read_all", appeal.channel)) {
      throw new ForbiddenError("Классификацию по эпику определяет HRD");
    }
    await appealRepository.setEpic(id, epicId);
    const updated = await appealRepository.findById(id);
    return this.serializeForStaff(updated!, user);
  }

  async addComment(
    user: AuthenticatedUser,
    id: string,
    text: string,
    visibility: "INTERNAL" | "PUBLIC",
    mentionedUserIds?: string[],
  ): Promise<AppealDTO> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    const isAssigned = appeal.assignments.some((a) => a.userId === user.id);
    if (
      !hasChannelPermission(user, "appeal.read_all", appeal.channel) &&
      !(hasChannelPermission(user, "appeal.read_assigned", appeal.channel) && isAssigned)
    ) {
      throw new ForbiddenError("Недостаточно прав для комментирования");
    }
    await appealRepository.addComment({ appealId: id, authorId: user.id, visibility, text });
    if (visibility === "PUBLIC") {
      await appealRepository.addMessage(id, true, text, user.id);
      await notificationService.notifyAuthorMessage(id, text);
    }
    if (visibility === "INTERNAL" && mentionedUserIds?.length) {
      // Тегаемый список = видящий список (назначенные + HRD/Admin) — иначе уведомление
      // ушло бы человеку, которому 403 при попытке открыть саму заметку.
      const candidates = await this.mentionCandidates(appeal);
      const validIds = new Set(candidates.map((c) => c.id));
      const snippet = text.length > 120 ? `${text.slice(0, 117)}...` : text;
      await Promise.all(
        mentionedUserIds
          .filter((uid) => uid !== user.id && validIds.has(uid))
          .map((uid) => notificationService.notifyMentioned(id, user.fullName, uid, snippet)),
      );
    }
    const updated = await appealRepository.findById(id);
    return this.serializeForStaff(updated!, user);
  }

  /** Список для @упоминаний во "Внутренней работе" (не общий справочник пользователей —
   * см. mentionCandidates: только те, кто и так видит эту заметку). */
  async listMentionable(user: AuthenticatedUser, id: string) {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    const isAssigned = appeal.assignments.some((a) => a.userId === user.id);
    if (
      !hasChannelPermission(user, "appeal.read_all", appeal.channel) &&
      !(hasChannelPermission(user, "appeal.read_assigned", appeal.channel) && isAssigned)
    ) {
      throw new ForbiddenError("Недостаточно прав для просмотра списка");
    }
    const candidates = await this.mentionCandidates(appeal);
    // Только id+fullName — это список для автокомплита тегов, не карточка
    // пользователя; sanitizeUser снимает лишь passwordHash/totpSecret, остальное
    // (email, mustChangePassword, totpEnabled...) тут лишнее и не нужно фронту.
    return candidates.map((u) => ({ id: u.id, fullName: u.fullName }));
  }

  private async mentionCandidates(appeal: AppealWithDetails) {
    const [hrds, admins] = await Promise.all([
      userRepository.findByRoleAndChannel("HRD", appeal.channel),
      userRepository.findByRoleAndChannel("ADMINISTRATOR", appeal.channel),
    ]);
    const assignees = appeal.assignments.map((a) => a.user);
    const seen = new Set<string>();
    return [...assignees, ...hrds, ...admins].filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  }

  /** Ответ автора на уточнение (SRS §4.4 UC-007) — доставляется ботом. */
  async addAuthorReply(telegramId: bigint, id: string, text: string): Promise<void> {
    const user = await this.assertActiveEmployee(telegramId);
    const appeal = await appealRepository.findById(id);
    if (!appeal || appeal.authorUserId !== user.id) {
      throw new NotFoundError("Обращение не найдено");
    }
    await appealRepository.addMessage(id, false, text);
    await notificationService.notifyHrdAuthorReplied(id);
  }

  async setRating(
    telegramId: bigint,
    id: string,
    score: number,
    comment?: string,
  ): Promise<void> {
    const user = await this.assertActiveEmployee(telegramId);
    const appeal = await appealRepository.findById(id);
    if (!appeal || appeal.authorUserId !== user.id) {
      throw new NotFoundError("Обращение не найдено");
    }
    if (appeal.status !== "CLOSED") {
      throw new ConflictError("Оценка доступна только после закрытия обращения (FR-EVL-002)");
    }
    await appealRepository.upsertRating(id, user.id, score, comment);
    if (score <= 2) {
      await notificationService.notifyLowRating(id, score);
    }
  }

  // --- Канал CUSTOMER (Фаза 7, PLAN.md §6) ---
  // Вложения здесь намеренно не поддерживаются в этом заходе: AppealAttachment
  // привязан только к User (uploadedByUserId), эквивалента для ExternalContact нет —
  // отдельная доработка (миграция + отдельные роуты вложений под requireBotService
  // ("CUSTOMER")), не входила в исходный запрос ("много не нужно").

  private async assertConsentedContact(telegramId: bigint) {
    const contact = await externalContactRepository.findByTelegramId(telegramId);
    if (!contact || !contact.consentAt) {
      throw new ForbiddenError("Обращение может создать только клиент, давший согласие на обработку данных");
    }
    return contact;
  }

  async createCustomerAppeal(input: {
    telegramId: bigint;
    type: string;
    mode: AppealMode;
    originalText: string;
  }) {
    const contact = await this.assertConsentedContact(input.telegramId);
    const appeal = await appealRepository.create({
      channel: "CUSTOMER",
      type: input.type,
      mode: input.mode,
      originalText: input.originalText,
      externalContactId: contact.id,
    });
    await notificationService.notifySalesNewAppeal(appeal.id);
    return appeal;
  }

  async getByIdForExternalContact(telegramId: bigint, id: string): Promise<AppealDTO> {
    const contact = await this.assertConsentedContact(telegramId);
    const appeal = await appealRepository.findById(id);
    if (!appeal || appeal.externalContactId !== contact.id) {
      throw new NotFoundError("Обращение не найдено");
    }
    return this.serializeForAuthor(appeal);
  }

  async listMineForExternalContact(telegramId: bigint, page: number, pageSize: number, bucket: "OPEN" | "CLOSED") {
    const contact = await this.assertConsentedContact(telegramId);
    const { items, total } = await appealRepository.list({
      channel: "CUSTOMER",
      externalContactId: contact.id,
      ...(bucket === "CLOSED" ? { status: "CLOSED" } : { excludeStatus: "CLOSED" }),
      page,
      pageSize,
    });
    return { items: items.map((a) => this.serializeForAuthor(a)), total };
  }

  /** Ответный аналог addAuthorReply для канала CUSTOMER (SRS §4.4 UC-007 по духу, не
   * по букве — у клиента нет уточняющих вопросов от HRD, но сама механика "добавить
   * сообщение в переписку по своему обращению" та же). Разрешено по любому не закрытому
   * обращению, не только в ответ на явный запрос — у клиента нет аналога "Задать вопрос",
   * бот просто предлагает написать сообщение из карточки обращения. */
  async addExternalContactReply(telegramId: bigint, id: string, text: string): Promise<void> {
    const contact = await this.assertConsentedContact(telegramId);
    const appeal = await appealRepository.findById(id);
    if (!appeal || appeal.externalContactId !== contact.id) {
      throw new NotFoundError("Обращение не найдено");
    }
    if (appeal.status === "CLOSED") {
      throw new ConflictError("Обращение закрыто — переписка недоступна");
    }
    await appealRepository.addMessage(id, false, text);
    await notificationService.notifySalesAuthorReplied(id);
  }

  async setCustomerRating(
    telegramId: bigint,
    id: string,
    wouldRecommendScore: number,
    wouldReturnScore: number,
  ): Promise<void> {
    const contact = await this.assertConsentedContact(telegramId);
    const appeal = await appealRepository.findById(id);
    if (!appeal || appeal.externalContactId !== contact.id) {
      throw new NotFoundError("Обращение не найдено");
    }
    if (appeal.status !== "CLOSED") {
      throw new ConflictError("Оценка доступна только после закрытия обращения (FR-EVL-002)");
    }
    await appealRepository.upsertCustomerRating(id, contact.id, wouldRecommendScore, wouldReturnScore);
    if (wouldRecommendScore <= 2 || wouldReturnScore <= 2) {
      await notificationService.notifyLowCustomerRating(id, wouldRecommendScore, wouldReturnScore);
    }
  }

  async getAttachmentUrl(user: AuthenticatedUser, appealId: string, attachmentId: string) {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    const isAssigned = appeal.assignments.some((a) => a.userId === user.id);
    if (
      !hasChannelPermission(user, "appeal.read_all", appeal.channel) &&
      !(hasChannelPermission(user, "appeal.read_assigned", appeal.channel) && isAssigned)
    ) {
      throw new ForbiddenError("Недостаточно прав для просмотра вложения");
    }
    const attachment = appeal.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new NotFoundError("Вложение не найдено");
    return getPresignedDownloadUrl(attachment.storageKey);
  }

  private serializeForStaff(appeal: AppealWithDetails, user: AuthenticatedUser): AppealDTO {
    const isAssigned = appeal.assignments.some((a) => a.userId === user.id);
    const authorVisible = canSeeAuthor(appeal, user, isAssigned);
    const canSeeInternal =
      hasChannelPermission(user, "appeal.read_all", appeal.channel) ||
      (hasChannelPermission(user, "appeal.read_assigned", appeal.channel) && isAssigned);

    return {
      id: appeal.id,
      publicNumber: appeal.publicNumber,
      channel: appeal.channel,
      type: appeal.type,
      mode: appeal.mode,
      status: appeal.status,
      resignationOutcome: appeal.resignationOutcome,
      epic: appeal.epic ? { id: appeal.epic.id, name: appeal.epic.name } : null,
      originalText: appeal.originalText,
      workingEdit: appeal.workingEdit,
      // author — User (EMPLOYEE) либо externalContact (CUSTOMER, Фаза 7): ровно один из
      // двух заполнен в зависимости от appeal.channel, как и authorUserId/externalContactId
      // в самой модели. До этой правки здесь проверялся только appeal.author — для CUSTOMER
      // он всегда null, поэтому SALES видел "Автор не указан" даже в открытом режиме.
      author: authorVisible
        ? appeal.author
          ? { id: appeal.author.id, fullName: appeal.author.fullName }
          : appeal.externalContact
            ? { id: appeal.externalContact.id, fullName: appeal.externalContact.fullName ?? "Без имени" }
            : null
        : null,
      isAuthorHidden: !authorVisible,
      canRevealAuthor: !authorVisible && canRevealAuthor(appeal, user),
      assignees: appeal.assignments.map((a) => ({ id: a.user.id, fullName: a.user.fullName })),
      attachmentsCount: appeal.attachments.length,
      attachments: appeal.attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
      })),
      comments: appeal.comments
        .filter((c) => canSeeInternal || c.visibility === "PUBLIC")
        .map((c) => ({
          id: c.id,
          authorId: c.authorId,
          authorFullName: c.author.fullName,
          visibility: c.visibility,
          text: c.text,
          isFinalAnswer: c.isFinalAnswer,
          createdAt: c.createdAt,
        })),
      messages: appeal.messages.map((m) => ({
        id: m.id,
        fromHrd: m.fromHrd,
        fromFullName: m.author?.fullName ?? null,
        text: m.text,
        createdAt: m.createdAt,
      })),
      statusHistory: appeal.statusHistory.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        createdAt: h.createdAt,
      })),
      rating: appeal.rating
        ? {
            score: appeal.rating.score,
            comment: appeal.rating.comment,
            wouldRecommendScore: appeal.rating.wouldRecommendScore,
            wouldReturnScore: appeal.rating.wouldReturnScore,
          }
        : null,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
      closedAt: appeal.closedAt,
      reopenDeadlineAt: appeal.reopenDeadlineAt,
      unreadCount: 0,
      unreadTabs: { messages: false, internal: false },
    };
  }

  /**
   * Раскрытие автора CONFIDENTIAL-обращения — отдельный шаг (не часть обычного
   * чтения), требует повторного пароля и журналируется (FR-CONF-005/FR-PRV-005).
   * Возвращает только { id, fullName }, не весь DTO — фронт мёржит это в уже
   * загруженную карточку сам, повторный GET не нужен.
   */
  async revealAuthor(
    user: AuthenticatedUser,
    id: string,
    password: string,
  ): Promise<{ id: string; fullName: string }> {
    const appeal = await appealRepository.findById(id);
    if (!appeal) throw new NotFoundError("Обращение не найдено");
    if (appeal.mode !== "CONFIDENTIAL") {
      throw new ValidationError("Обращение не в конфиденциальном режиме");
    }
    if (!canRevealAuthor(appeal, user)) {
      throw new ForbiddenError("Недостаточно прав для раскрытия автора");
    }
    // author — User (EMPLOYEE) либо externalContact (CUSTOMER, Фаза 7) — тот же union,
    // что и в serializeForStaff; appeal.author всегда null для клиентских обращений.
    const revealed = appeal.author ?? appeal.externalContact;
    if (!revealed) throw new NotFoundError("Автор не найден");

    await authService.verifyPassword(user.id, password);

    await auditService.record({
      actorId: user.id,
      action: "appeal.view_confidential_author",
      objectType: "Appeal",
      objectId: appeal.id,
      appealId: appeal.id,
      result: "success",
    });

    return { id: revealed.id, fullName: revealed.fullName ?? "Без имени" };
  }

  private serializeForAuthor(appeal: AppealWithDetails): AppealDTO {
    return {
      id: appeal.id,
      publicNumber: appeal.publicNumber,
      channel: appeal.channel,
      type: appeal.type,
      mode: appeal.mode,
      status: appeal.status,
      resignationOutcome: appeal.resignationOutcome,
      epic: appeal.epic ? { id: appeal.epic.id, name: appeal.epic.name } : null,
      originalText: appeal.originalText,
      workingEdit: null, // автору рабочая редакция не показывается — это внутренний инструмент HRD
      author: appeal.author
        ? { id: appeal.author.id, fullName: appeal.author.fullName }
        : appeal.externalContact
          ? { id: appeal.externalContact.id, fullName: appeal.externalContact.fullName ?? "Без имени" }
          : null,
      isAuthorHidden: false,
      canRevealAuthor: false,
      assignees: [], // сотрудник не видит исполнителя (FR §4.1 "не может менять исполнителя")
      attachmentsCount: appeal.attachments.length,
      attachments: appeal.attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
      })),
      comments: appeal.comments
        .filter((c) => c.visibility === "PUBLIC")
        .map((c) => ({
          id: c.id,
          authorId: c.authorId,
          authorFullName: c.author.fullName,
          visibility: c.visibility,
          text: c.text,
          isFinalAnswer: c.isFinalAnswer,
          createdAt: c.createdAt,
        })),
      messages: appeal.messages.map((m) => ({
        id: m.id,
        fromHrd: m.fromHrd,
        fromFullName: m.author?.fullName ?? null,
        text: m.text,
        createdAt: m.createdAt,
      })),
      statusHistory: appeal.statusHistory.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        createdAt: h.createdAt,
      })),
      rating: appeal.rating
        ? {
            score: appeal.rating.score,
            comment: appeal.rating.comment,
            wouldRecommendScore: appeal.rating.wouldRecommendScore,
            wouldReturnScore: appeal.rating.wouldReturnScore,
          }
        : null,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
      closedAt: appeal.closedAt,
      reopenDeadlineAt: appeal.reopenDeadlineAt,
      unreadCount: 0,
      unreadTabs: { messages: false, internal: false },
    };
  }
}

export const appealService = new AppealService();
