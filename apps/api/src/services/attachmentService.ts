import { randomUUID } from "node:crypto";
import { appealRepository } from "@/repositories/AppealRepository.js";
import { deleteObject, uploadObject } from "@/lib/storage.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { ForbiddenError, ValidationError } from "@/types/index.js";

const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_DRAFT = 10;

/** SRS §10: до 10 файлов, лимиты 20МБ/100МБ, тип проверяется по MIME (не по расширению). */
export class AttachmentService {
  async uploadDraft(params: {
    telegramId: bigint;
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }) {
    const user = await userRepository.findByTelegramId(params.telegramId);
    if (!user || user.status !== "ACTIVE") {
      throw new ForbiddenError("Загрузка вложений доступна только подтверждённому сотруднику");
    }

    const kind = PHOTO_MIME.has(params.mimeType)
      ? "PHOTO"
      : VIDEO_MIME.has(params.mimeType)
        ? "VIDEO"
        : null;
    if (!kind) {
      throw new ValidationError(`Неподдерживаемый тип файла: ${params.mimeType}`);
    }
    const maxBytes = kind === "PHOTO" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
    if (params.buffer.length > maxBytes) {
      throw new ValidationError(`Файл превышает допустимый размер (${maxBytes / (1024 * 1024)} МБ)`);
    }

    const existingCount = await appealRepository.countDraftAttachments(user.id);
    if (existingCount >= MAX_ATTACHMENTS_PER_DRAFT) {
      throw new ValidationError("Достигнут лимит 10 файлов на обращение (FR-FILE-002)");
    }

    const ext = params.originalName.includes(".") ? params.originalName.split(".").pop() : undefined;
    const storageKey = `drafts/${user.id}/${randomUUID()}${ext ? `.${ext}` : ""}`;
    await uploadObject(storageKey, params.buffer, params.mimeType);

    const attachment = await appealRepository.addDraftAttachment({
      uploadedByUserId: user.id,
      storageKey,
      mimeType: params.mimeType,
      fileSize: params.buffer.length,
      kind,
    });

    return { id: attachment.id, count: existingCount + 1 };
  }

  async removeDraft(telegramId: bigint, attachmentId: string): Promise<void> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new ForbiddenError();
    const removed = await appealRepository.deleteDraftAttachment(attachmentId, user.id);
    if (!removed) throw new ValidationError("Вложение не найдено среди черновиков пользователя");
  }

  /** Периодическая очистка (FR-DRF-006) — запускается из server.ts по расписанию. */
  async cleanupExpiredDrafts(): Promise<number> {
    const expired = await appealRepository.findExpiredDraftAttachments();
    for (const item of expired) {
      await deleteObject(item.storageKey).catch(() => undefined);
      await appealRepository.markAttachmentDeleted(item.id);
    }
    return expired.length;
  }
}

export const attachmentService = new AttachmentService();
