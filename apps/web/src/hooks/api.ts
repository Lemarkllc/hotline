import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel } from "@hotline/shared";
import { apiRequest } from "@/lib/apiClient";
import { useAuthStore, type AuthUser } from "@/lib/authStore";

// --- Auth ---

export function useLogin() {
  return useMutation({
    mutationFn: (input: { email: string; password: string; totpCode?: string }) =>
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; fullName: string; mustChangePassword: boolean };
      }>("/auth/login", { method: "POST", body: input, skipAuth: true }),
  });
}

export function useBeginTwoFactorSetup() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiRequest<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", {
        method: "POST",
        body: input,
        skipAuth: true,
      }),
  });
}

export function useConfirmTwoFactorSetup() {
  return useMutation({
    mutationFn: (input: { email: string; password: string; code: string }) =>
      apiRequest<{ ok: true }>("/auth/2fa/confirm", { method: "POST", body: input, skipAuth: true }),
  });
}

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    // Ключ включает accessToken — иначе повторный логин (logout -> login в течение
    // staleTime, 15с по умолчанию) отдаёт закэшированный ответ под старым ["me"] и
    // ни разу не вызывает queryFn, а значит и setUser(): permissions в сторе остаются
    // пустыми (logout их обнулил) до ручного обновления страницы. Новый accessToken
    // = новый ключ = гарантированный свежий запрос.
    queryKey: ["me", accessToken],
    queryFn: async () => {
      const user = await apiRequest<AuthUser>("/auth/me");
      setUser(user);
      return user;
    },
    enabled: Boolean(accessToken),
    retry: false,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      apiRequest<{ ok: true }>("/auth/change-password", { method: "POST", body: input }),
  });
}

// --- Appeals ---

export interface AppealListFilters {
  channel: Channel;
  page: number;
  pageSize: number;
  status?: string;
  excludeStatus?: string;
  type?: string;
  epicId?: string;
  mode?: string;
  assigneeId?: string;
  search?: string;
  /** Открыто/На проверке + без назначенного — конкретное подмножество, не "весь список". */
  backlogOnly?: boolean;
  /** Оценка 1-2 (FR-EVL-005), не точное совпадение как ratingScore. */
  lowRatingOnly?: boolean;
}

export function useAppeals(filters: AppealListFilters) {
  return useQuery({
    queryKey: ["appeals", filters],
    queryFn: () =>
      apiRequest<{ items: AppealDTO[]; total: number }>("/appeals", {
        query: filters as unknown as Record<string, string | number | boolean | undefined>,
      }),
    // Новые обращения и смена статуса (список/Канбан) не толкаются с бэкенда —
    // страница должна сама подтягивать их, иначе видно только после ручного обновления.
    refetchInterval: 5000,
  });
}

export function useAppeal(id: string | undefined) {
  return useQuery({
    queryKey: ["appeal", id],
    queryFn: () => apiRequest<AppealDTO>(`/appeals/${id}`),
    enabled: Boolean(id),
    // Переписка (SRS §35.10) не толкается с бэкенда — открытая карточка обращения
    // должна сама подтягивать новые сообщения, иначе HRD видит их только после
    // ручного обновления страницы.
    refetchInterval: 5000,
  });
}

export interface AppealDTO {
  id: string;
  publicNumber: string;
  channel: Channel;
  type: string;
  mode: "OPEN" | "CONFIDENTIAL";
  status: "OPEN" | "UNDER_REVIEW" | "IN_PROGRESS" | "CLOSED";
  /** Только type="RESIGNATION" — исход закрытия. */
  resignationOutcome: "TERMINATED" | "WITHDRAWN" | null;
  epic: { id: string; name: string } | null;
  originalText: string;
  workingEdit: string | null;
  author: { id: string; fullName: string } | null;
  isAuthorHidden: boolean;
  canRevealAuthor: boolean;
  assignees: { id: string; fullName: string }[];
  attachmentsCount: number;
  attachments: { id: string; kind: string; mimeType: string; fileSize: number; createdAt: string }[];
  comments: {
    id: string;
    authorId: string;
    authorFullName: string;
    visibility: string;
    text: string;
    isFinalAnswer: boolean;
    createdAt: string;
  }[];
  messages: { id: string; fromHrd: boolean; fromFullName: string | null; text: string; createdAt: string }[];
  statusHistory: { fromStatus: string | null; toStatus: string; createdAt: string }[];
  rating: {
    score: number | null;
    comment: string | null;
    wouldRecommendScore: number | null;
    wouldReturnScore: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  unreadCount: number;
  unreadTabs: { messages: boolean; internal: boolean };
}

function useInvalidateAppeal(id?: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["appeals"] });
    if (id) void qc.invalidateQueries({ queryKey: ["appeal", id] });
  };
}

export function useChangeStatus(id: string) {
  const invalidate = useInvalidateAppeal(id);
  return useMutation({
    mutationFn: (input: {
      toStatus: string;
      reason?: string;
      finalAnswer?: string;
      resignationOutcome?: "TERMINATED" | "WITHDRAWN";
    }) => apiRequest<AppealDTO>(`/appeals/${id}/status`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

/** Вариант для мест, где id обращения известен только в момент вызова (например, drag-and-drop
 * в Kanban) — обычный useChangeStatus(id) требует id уже на рендере хука, что там недоступно. */
export function useChangeStatusAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      toStatus: string;
      reason?: string;
      finalAnswer?: string;
      resignationOutcome?: "TERMINATED" | "WITHDRAWN";
    }) => apiRequest<AppealDTO>(`/appeals/${id}/status`, { method: "PATCH", body: input }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["appeals"] });
      void qc.invalidateQueries({ queryKey: ["appeal", vars.id] });
    },
  });
}

export function useAssignAppeal(id: string) {
  const invalidate = useInvalidateAppeal(id);
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<AppealDTO>(`/appeals/${id}/assign`, { method: "POST", body: { userId } }),
    onSuccess: invalidate,
  });
}

export function useSetWorkingEdit(id: string) {
  const invalidate = useInvalidateAppeal(id);
  return useMutation({
    mutationFn: (workingEdit: string) =>
      apiRequest<AppealDTO>(`/appeals/${id}/working-edit`, { method: "POST", body: { workingEdit } }),
    onSuccess: invalidate,
  });
}

export function useSetEpic(id: string) {
  const invalidate = useInvalidateAppeal(id);
  return useMutation({
    mutationFn: (epicId: string | null) =>
      apiRequest<AppealDTO>(`/appeals/${id}/epic`, { method: "POST", body: { epicId } }),
    onSuccess: invalidate,
  });
}

export function useAddComment(id: string) {
  const invalidate = useInvalidateAppeal(id);
  return useMutation({
    mutationFn: (input: { text: string; visibility: "INTERNAL" | "PUBLIC"; mentionedUserIds?: string[] }) =>
      apiRequest(`/appeals/${id}/comments`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

/** Список для @упоминаний во "Внутренней работе" — не общий справочник пользователей,
 * а только те, кто и так видит эту заметку (назначенные на обращение + HRD/Admin,
 * см. appealService.listMentionable на бэкенде). */
export function useMentionableUsers(appealId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["mentionable-users", appealId],
    queryFn: () => apiRequest<{ id: string; fullName: string }[]>(`/appeals/${appealId}/mentionable-users`),
    enabled,
  });
}

export function useAttachmentUrl() {
  return useMutation({
    mutationFn: ({ appealId, attachmentId }: { appealId: string; attachmentId: string }) =>
      apiRequest<{ url: string }>(`/appeals/${appealId}/attachments/${attachmentId}/url`),
  });
}

/** Раскрытие автора CONFIDENTIAL-обращения — повторный ввод пароля, каждый вызов
 * журналируется на бэкенде. Результат не кладём в react-query кэш appeal'а (сервер
 * его туда и не отдаёт) — компонент держит его в локальном state сам. */
export function useRevealAuthor(appealId: string) {
  return useMutation({
    mutationFn: (password: string) =>
      apiRequest<{ id: string; fullName: string }>(`/appeals/${appealId}/reveal-author`, {
        method: "POST",
        body: { password },
      }),
  });
}

// --- Epics ---

export function useEpics(channel: Channel = "EMPLOYEE") {
  return useQuery({
    queryKey: ["epics", channel],
    queryFn: () => apiRequest<{ id: string; name: string; isActive: boolean }[]>("/epics", { query: { channel } }),
  });
}

export function useCreateEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel: Channel; name: string }) =>
      apiRequest("/epics", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["epics"] }),
  });
}

export function useSetEpicActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/epics/${id}/active`, { method: "PATCH", body: { isActive } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["epics"] }),
  });
}

// --- Users ---

export interface UserDTO {
  id: string;
  telegramId: string | null;
  fullName: string;
  status: string;
  roleNames?: string[];
  email: string | null;
  createdAt: string;
}

export function useUsers(status?: string) {
  return useQuery({
    queryKey: ["users", status],
    queryFn: () => apiRequest<UserDTO[]>("/users", { query: { status } }),
  });
}

/** Список "кому назначить обращение" — отдельно от useUsers(), которая требует
 * user.manage. Назначающий (appeal.assign, обычно HRD) не обязан администрировать
 * пользователей — см. UserService.listAssignable на бэкенде. */
export function useAssignableUsers(channel: Channel = "EMPLOYEE", enabled = true) {
  return useQuery({
    queryKey: ["assignable-users", channel],
    queryFn: () => apiRequest<UserDTO[]>("/appeals/assignable-users", { query: { channel } }),
    enabled,
  });
}

export function useAccessRequests(enabled = true) {
  return useQuery({
    queryKey: ["access-requests"],
    queryFn: () =>
      apiRequest<
        { id: string; telegramId: string; fullName: string; createdAt: string; user: UserDTO }[]
      >("/users/access-requests"),
    enabled,
    // Живой счётчик в Sidebar (новые регистрации из бота) — тот же каданс, что и
    // у колокольчика (useNotifications), не отдельный опрос.
    refetchInterval: 15000,
  });
}

export function useApproveAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/users/access-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["access-requests"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useRejectAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiRequest(`/users/access-requests/${id}/reject`, { method: "POST", body: { reason } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["access-requests"] }),
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/users/${id}/block`, { method: "POST", body: { reason } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/users/${id}/unblock`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      fullName?: string;
      telegramId?: string | null;
      roleNames?: string[];
    }) => apiRequest<UserDTO>(`/users/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ temporaryPassword: string }>(`/users/${id}/reset-password`, { method: "POST" }),
  });
}

export function useCreateWebAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      fullName: string;
      temporaryPassword: string;
      roleNames: string[];
    }) => apiRequest<UserDTO>("/users", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

// --- Reports ---

export interface ReportSummary {
  period: { from: string; to: string };
  created: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byEpic: { epicId: string | null; count: number }[];
  avgRating: number | null;
  lowRatingShare: number | null;
  avgFirstResponseMinutes: number | null;
  avgClosingMinutes: number | null;
  reopenedCount: number;
  backlogAtPeriodEnd: number;
  /** Заявления на увольнение (type="RESIGNATION"), закрытые в периоде — по исходу. */
  resignationsTerminated: number;
  resignationsWithdrawn: number;
}

export function useReportSummary(channel: Channel, from: string, to: string) {
  return useQuery({
    queryKey: ["report-summary", channel, from, to],
    queryFn: () => apiRequest<ReportSummary>("/reports/summary", { query: { channel, from, to } }),
  });
}

/**
 * Экспорт нельзя оформить как обычную <a href> ссылку: API требует Bearer-токен
 * (requireWebAuth), а браузерная навигация не добавляет кастомные заголовки —
 * такой запрос всегда падал бы 401. Поэтому качаем через fetch с заголовком и
 * триггерим сохранение вручную через Blob URL.
 */
export async function downloadReportExport(
  channel: Channel,
  from: string,
  to: string,
  format: "csv" | "xlsx",
  includeAuthor: boolean,
): Promise<void> {
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
  const params = new URLSearchParams({ channel, from, to, format, includeAuthor: String(includeAuthor) });
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${base}/reports/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Не удалось выгрузить отчёт");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${channel}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Audit ---

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  result: string;
  createdAt: string;
  reason: string | null;
}

export function useAuditLog(filters: { action?: string; appealId?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: () => apiRequest<AuditEntry[]>("/audit", { query: filters }),
    enabled,
  });
}

// --- Notifications ---

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      apiRequest<
        { id: string; appealId: string | null; payload: Record<string, unknown>; status: string; createdAt: string }[]
      >("/notifications"),
    refetchInterval: 15000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
