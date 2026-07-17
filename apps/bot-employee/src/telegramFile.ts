import type { Api } from "grammy";
import { config } from "./config.js";

export interface DownloadedFile {
  blob: Blob;
  mimeType: string;
  filename: string;
  kind: "PHOTO" | "VIDEO";
}

/** SRS §10: MVP поддерживает только фото и видео — остальные типы вложений отклоняются раньше, в handler'е. */
export async function downloadTelegramMedia(
  api: Api,
  message: { photo?: { file_id: string }[]; video?: { file_id: string; mime_type?: string } },
): Promise<DownloadedFile | null> {
  let fileId: string;
  let mimeType: string;
  let kind: "PHOTO" | "VIDEO";
  let ext: string;

  if (message.video) {
    fileId = message.video.file_id;
    mimeType = message.video.mime_type ?? "video/mp4";
    kind = "VIDEO";
    ext = "mp4";
  } else if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1]!;
    fileId = largest.file_id;
    mimeType = "image/jpeg";
    kind = "PHOTO";
    ext = "jpg";
  } else {
    return null;
  }

  const file = await api.getFile(fileId);
  if (!file.file_path) return null;
  const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();

  return {
    blob: new Blob([arrayBuffer], { type: mimeType }),
    mimeType,
    filename: `${fileId}.${ext}`,
    kind,
  };
}
