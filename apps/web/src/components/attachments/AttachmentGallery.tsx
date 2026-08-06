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

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function Thumbnail({
  attachment,
  queryKey,
  fetchUrl,
  onOpenImage,
}: {
  attachment: GalleryAttachment;
  queryKey: unknown[];
  fetchUrl: () => Promise<string>;
  onOpenImage: (url: string) => void;
}) {
  // staleTime чуть меньше серверного TTL presigned-ссылки (5 мин, см.
  // getPresignedDownloadUrl) — чтобы не показывать протухшую ссылку из кэша.
  const { data: url, isLoading } = useQuery({
    queryKey,
    queryFn: fetchUrl,
    staleTime: 4 * 60 * 1000,
  });
  const image = isImage(attachment.mimeType);

  function handleClick() {
    if (!url) return;
    if (image) onOpenImage(url);
    else window.open(url, "_blank");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
 * Миниатюры вложений с открытием полной картинки в модалке (не отдельной вкладкой/
 * навигацией) — общий компонент для карточки обращения и карточки заявки ("Заявки",
 * email-лиды), обе стороны просто передают свой способ получить presigned URL.
 */
export function AttachmentGallery({
  attachments,
  getQueryKey,
  fetchUrl,
}: {
  attachments: GalleryAttachment[];
  getQueryKey: (attachmentId: string) => unknown[];
  fetchUrl: (attachmentId: string) => Promise<string>;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!attachments.length) {
    return <p className="text-sm text-muted-foreground">Вложений нет.</p>;
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
            onOpenImage={setLightboxUrl}
          />
        ))}
      </div>

      <Dialog open={Boolean(lightboxUrl)} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl">
          {lightboxUrl && (
            <div className="flex flex-col gap-3">
              <img src={lightboxUrl} alt="Вложение" className="max-h-[75vh] w-full rounded-md object-contain" />
              <a
                href={lightboxUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Download className="size-4" /> Открыть в полном размере
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
