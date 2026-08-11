import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface GalleryAttachment {
  id: string;
  mimeType: string;
  fileSize: number;
  /** Имя файла (вложения из писем) или подпись вида "Фото"/"Видео" (вложения из бота). */
  label?: string;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function Thumbnail({
  attachment,
  queryKey,
  fetchUrl,
  onOpen,
}: {
  attachment: GalleryAttachment;
  queryKey: unknown[];
  fetchUrl: () => Promise<string>;
  onOpen: (attachment: GalleryAttachment, url: string) => void;
}) {
  // staleTime чуть меньше серверного TTL presigned-ссылки (5 мин, см.
  // getPresignedDownloadUrl) — чтобы не показывать протухшую ссылку из кэша.
  const { data: url, isLoading } = useQuery({
    queryKey,
    queryFn: fetchUrl,
    staleTime: 4 * 60 * 1000,
  });
  const image = isImage(attachment.mimeType);

  return (
    <button
      type="button"
      onClick={() => url && onOpen(attachment, url)}
      disabled={!url}
      title={attachment.label}
      className="group flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-center transition-colors hover:bg-background disabled:cursor-wait"
    >
      {image ? (
        url ? (
          <img src={url} alt={attachment.label ?? "Вложение"} className="size-24 rounded-md object-cover" />
        ) : (
          <div className="size-24 animate-pulse rounded-md bg-muted" />
        )
      ) : (
        <div className="flex size-24 items-center justify-center rounded-md bg-muted">
          <FileText className="size-8 text-muted-foreground" />
        </div>
      )}
      <span className="max-w-24 truncate text-xs text-muted-foreground">
        {isLoading ? "Загрузка..." : (attachment.label ?? formatSize(attachment.fileSize))}
      </span>
    </button>
  );
}

/**
 * Все вложения открываются в диалоге приложения — не отдельной вкладкой/навигацией
 * (реальная жалоба: в PWA standalone-режиме новая вкладка/окно оставляли без пути
 * назад). Диалог сам и есть "путь назад" — стандартный крестик/Escape/клик снаружи,
 * никогда не покидает страницу. Внутри — превью, что можем (картинка, PDF), для
 * остального — понятное сообщение и отдельная кнопка "Скачать" (та уже осознанно
 * скачивает файл, Content-Disposition: attachment только для неё, см. storage.ts).
 * Общий компонент для карточки обращения и карточки заявки ("Заявки", email-лиды).
 */
export function AttachmentGallery({
  attachments,
  getQueryKey,
  fetchUrl,
}: {
  attachments: GalleryAttachment[];
  getQueryKey: (attachmentId: string) => unknown[];
  fetchUrl: (attachmentId: string, download?: boolean) => Promise<string>;
}) {
  const [viewing, setViewing] = useState<{ attachment: GalleryAttachment; url: string } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!attachments.length) {
    return <p className="text-sm text-muted-foreground">Вложений нет.</p>;
  }

  async function handleOpen(attachment: GalleryAttachment, url: string) {
    setViewing({ attachment, url });
    setDownloadUrl(null);
    // Отдельная, форсирующая скачивание ссылка — подгружается сразу же, чтобы кнопка
    // "Скачать" была готова к моменту, когда на неё посмотрят, но сам просмотр (img/
    // iframe выше) идёт по обычной, не форсирующей скачивание ссылке.
    setDownloadUrl(await fetchUrl(attachment.id, true));
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {attachments.map((a) => (
          <Thumbnail
            key={a.id}
            attachment={a}
            queryKey={getQueryKey(a.id)}
            fetchUrl={() => fetchUrl(a.id)}
            onOpen={handleOpen}
          />
        ))}
      </div>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          {viewing && (
            <div className="flex flex-col gap-3">
              {isImage(viewing.attachment.mimeType) ? (
                <img
                  src={viewing.url}
                  alt={viewing.attachment.label ?? "Вложение"}
                  className="max-h-[75vh] w-full rounded-md object-contain"
                />
              ) : isPdf(viewing.attachment.mimeType) ? (
                <iframe src={viewing.url} title={viewing.attachment.label ?? "Вложение"} className="h-[75vh] w-full rounded-md border border-border" />
              ) : (
                <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
                  Предпросмотр недоступен для этого типа файла — скачайте, чтобы открыть.
                </p>
              )}
              <a
                href={downloadUrl ?? viewing.url}
                className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Download className="size-4" /> Скачать
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
