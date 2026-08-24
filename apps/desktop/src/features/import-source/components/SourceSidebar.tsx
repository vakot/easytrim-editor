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

  const sourceName = session.source?.selection.displayName ?? t("import.source.noSource");

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
          <Tooltip>
            <TooltipTrigger asChild>
              <h1 id="source-title" className="truncate text-base font-black">
                {sourceName}
              </h1>
            </TooltipTrigger>
            <TooltipContent>{sourceName}</TooltipContent>
          </Tooltip>
          {session.status === "loading-source" ? (
            <span className="text-xs text-muted-foreground" role="status">
              {t("import.source.inspecting")}
            </span>
          ) : null}
        </div>

        {session.lastError ? <SourceError error={session.lastError} /> : null}
        <MediaDetails media={session.source?.media ?? null} />
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
