import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { config } from "@/config/unifiedConfig.js";

/**
 * Приватное файловое хранилище вне публичной директории (SRS §10, §21).
 * Доступ к файлу — только через presigned URL с коротким TTL, выданный после
 * проверки RBAC в appealService, никогда напрямую по storageKey.
 */
const s3 = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  forcePathStyle: config.storage.forcePathStyle,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
});

/** Отдельный клиент ТОЛЬКО для подписи presigned-ссылок (getSignedUrl не делает
 * сетевых запросов — просто считает подпись по конфигу клиента) — см. комментарий
 * у config.storage.publicEndpoint про то, зачем публичный адрес отличается от
 * внутреннего. */
const s3PublicSigner = new S3Client({
  endpoint: config.storage.publicEndpoint || config.storage.endpoint,
  region: config.storage.region,
  forcePathStyle: config.storage.forcePathStyle,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
});

/** Идемпотентно — вызывается один раз при старте сервера (server.ts). Локальный MinIO
 * не создаёт бакеты сам по себе; в managed S3 бакет обычно создаётся инфраструктурой заранее. */
export async function ensureBucketExists(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.storage.bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.storage.bucket }));
  }
}

export function buildStorageKey(appealId: string, originalName: string): string {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : undefined;
  return `appeals/${appealId}/${randomUUID()}${ext ? `.${ext}` : ""}`;
}

/** Вложения из писем клиентов ("Заявки") — отдельное пространство ключей от
 * appeals/*. Без ID заявки в пути (в отличие от buildStorageKey): на момент
 * загрузки письма в S3 заявка в БД ещё может не существовать (первое письмо
 * создаёт её), а сам randomUUID() уже даёт уникальность и без группировки по ID. */
export function buildLeadAttachmentStorageKey(originalName: string): string {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : undefined;
  return `leads/${randomUUID()}${ext ? `.${ext}` : ""}`;
}

export async function uploadObject(
  storageKey: string,
  body: Buffer,
  mimeType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
    }),
  );
}

/** Нужен для пересылки вложений в Bitrix24 (crm.timeline.comment.add ждёт файл
 * как base64 в теле запроса, не ссылкой) — единственный вызывающий на сейчас,
 * см. bitrixService/leadService. */
export async function downloadObject(storageKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: config.storage.bucket, Key: storageKey });
  const response = await s3.send(command);
  const bytes = await response.Body?.transformToByteArray();
  return Buffer.from(bytes ?? []);
}

export async function getPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.storage.bucket, Key: storageKey });
  return getSignedUrl(s3PublicSigner, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: storageKey }));
}
