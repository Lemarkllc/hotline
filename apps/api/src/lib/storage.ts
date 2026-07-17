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

export async function getPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.storage.bucket, Key: storageKey });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: storageKey }));
}
