import { Fragment } from "react";
import type { SessionState } from "@/app/session-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ExportQueue, type ExportToast } from "@/features/export";
import { MediaDetails } from "./MediaDetails";
import { SourceError } from "./SourceError";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SourceSidebarProps {
  session: SessionState;
  queue: ExportToast[];
}

export function SourceSidebar({ session, queue }: SourceSidebarProps) {
  const { t } = useTranslation();
  const source = session.source;

  return (
    <aside
      className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]"
      aria-labelledby="source-title"
    >
      <div className="grid content-start gap-5 p-5" data-slot="source-details">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold tracking-[0.14em] text-primary uppercase">
            {t("import.source.details")}
          </p>
          {source ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 id="source-title" className="truncate text-base font-black">
                  {source.selection.displayName}
                </h1>
              </TooltipTrigger>
              <TooltipContent>{source.selection.displayName}</TooltipContent>
            </Tooltip>
          ) : (
            <h1 id="source-title" className="truncate text-base font-black">
              {t("import.emptyStage.noSource")}
            </h1>
          )}
          {source && session.status === "loading-source" ? (
            <span className="text-xs text-muted-foreground" role="status">
              {t("import.source.inspecting")}
            </span>
          ) : null}
        </div>

        {source && session.lastError ? <SourceError error={session.lastError} /> : null}
        {session.status === "ready" && source?.media ? (
          <MediaDetails media={source.media} />
        ) : !source ? (
          <EmptyMediaDetails />
        ) : null}
      </div>
      <Separator className="mx-4" />
      <ScrollArea className="min-h-0" data-slot="export-queue-scroll">
        <div className="p-5">
          <ExportQueue queue={queue} />
        </div>
      </ScrollArea>
    </aside>
  );
}

function EmptyMediaDetails() {
  const { t } = useTranslation();
  const metadata = [
    t("import.source.metadata.container"),
    t("import.source.metadata.duration"),
    t("import.source.metadata.resolution"),
    t("import.source.metadata.frameRate"),
    t("import.source.metadata.videoCodec"),
    t("import.source.metadata.fileSize"),
    t("import.source.metadata.bitrate"),
  ];

  return (
    <dl className="grid" aria-label={t("import.source.metadataLabel")}>
      {metadata.map((label, index) => (
        <Fragment key={label}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-right text-xs font-medium text-muted-foreground">
              {t("import.source.noSourceValue")}
            </dd>
          </div>
          {index < metadata.length - 1 ? <Separator className="bg-border/55" /> : null}
        </Fragment>
      ))}
    </dl>
  );
}
