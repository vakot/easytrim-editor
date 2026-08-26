import { useAppSelector } from "@/app/store/hooks";
import {
  selectSourceError,
  selectSourceMedia,
  selectSourceSelection,
  selectSourceStatus,
} from "@/app/store/slices/source-slice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ExportQueue } from "@/features/export";
import { MediaDetails } from "./MediaDetails";
import { SourceError } from "./SourceError";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImportedQueue } from "./ImportedQueue";

export function SourceSidebar() {
  const { t } = useTranslation();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const status = useAppSelector(selectSourceStatus);
  const lastError = useAppSelector(selectSourceError);

  const sourceName = sourceSelection?.displayName ?? t("import.source.noSource");

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
          {status === "loading-source" ? (
            <span className="text-xs text-muted-foreground" role="status">
              {t("import.source.inspecting")}
            </span>
          ) : null}
        </div>

        {lastError ? <SourceError error={lastError} /> : null}
        <MediaDetails media={media} />
        <ImportedQueue />
      </div>
      <Separator className="mx-4" />
      <ScrollArea className="min-h-0" data-slot="export-queue-scroll">
        <div className="p-5">
          <ExportQueue />
        </div>
      </ScrollArea>
    </aside>
  );
}
