import { FileVideo, LoaderCircle, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedSourceThumbnail } from "@/app/store/slices/preview-slice";
import { cn } from "@/lib/class-names.utils";

import { useSourceCardData } from "../hooks/useSourceCardData";

function SourceCardThumbnail({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const source = useSourceCardData();
  const { t } = useTranslation();

  const id = source.id;
  const { displayName } = source.snapshot.source;
  const thumbnail = useAppSelector((state) => selectImportedSourceThumbnail(state, id));
  const thumbnailUrl = thumbnail?.status === "ready" ? thumbnail.value.url : undefined;
  const thumbnailLoading =
    !thumbnailUrl &&
    source.sourceAvailability === "available" &&
    (thumbnail === undefined || thumbnail.status === "loading");

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden bg-muted text-muted-foreground shadow-md",
        className,
      )}
    >
      {thumbnailUrl ? (
        <>
          <img
            alt={`${displayName} thumbnail`}
            aria-label={`${displayName} thumbnail`}
            className="size-full object-cover transition-transform"
            src={thumbnailUrl}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full border border-input bg-background text-foreground group-hover/source-card:visible"
          >
            <Play aria-hidden="true" className="size-4" />
          </span>
        </>
      ) : thumbnailLoading ? (
        <span
          aria-label={t("source.status.loading")}
          className="grid size-full place-items-center bg-linear-to-br from-muted to-background"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary" />
        </span>
      ) : (
        <span className="grid size-full place-items-center bg-linear-to-br from-muted to-background">
          <span className="grid justify-items-center gap-2">
            <FileVideo aria-hidden="true" className="size-8 opacity-40" />
            <span className="text-[10px]">{t("source.messages.previewUnavailable")}</span>
          </span>
        </span>
      )}

      {children}
    </div>
  );
}

export { SourceCardThumbnail };
