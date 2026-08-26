import { useAppSelector } from "@/app/store/hooks";
import {
  selectSourceError,
  selectSourceMedia,
  selectSourceSelection,
  selectSourceStatus,
} from "@/app/store/slices/source-slice";
import {
  ResizableSection,
  ResizableSectionContent,
  ResizableSections,
  ResizableSectionTrigger,
} from "@/components/layout/ResizableSections";
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
    <aside className="flex h-full min-h-0 min-w-0 flex-col" aria-labelledby="source-title">
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
      </div>
      <ResizableSections className="min-h-0 min-w-0 flex-1" data-slot="source-sections">
        <ResizableSection
          id="media-details"
          defaultSize="11rem"
          minSize="8rem"
          maxSize="18rem"
          groupResizeBehavior="preserve-pixel-size"
          separatorLabel={t("import.source.resizeSection", {
            section: t("import.source.sections.mediaDetails"),
          })}
        >
          <ResizableSectionTrigger>
            {t("import.source.sections.mediaDetails")}
          </ResizableSectionTrigger>
          <ResizableSectionContent className="p-5">
            <MediaDetails media={media} />
          </ResizableSectionContent>
        </ResizableSection>

        <ResizableSection
          id="imported-queue"
          defaultSize="10rem"
          minSize="7rem"
          maxSize="18rem"
          groupResizeBehavior="preserve-pixel-size"
          separatorLabel={t("import.source.resizeSection", {
            section: t("import.source.sections.importedQueue"),
          })}
        >
          <ResizableSectionTrigger>
            {t("import.source.sections.importedQueue")}
          </ResizableSectionTrigger>
          <ResizableSectionContent className="p-5">
            <ImportedQueue />
          </ResizableSectionContent>
        </ResizableSection>

        <ResizableSection
          id="export-queue"
          defaultSize="16rem"
          minSize="8rem"
          groupResizeBehavior="preserve-relative-size"
          separatorLabel={t("import.source.resizeSection", {
            section: t("import.source.sections.exportQueue"),
          })}
        >
          <ResizableSectionTrigger>
            {t("import.source.sections.exportQueue")}
          </ResizableSectionTrigger>
          <ResizableSectionContent className="p-5">
            <ExportQueue />
          </ResizableSectionContent>
        </ResizableSection>
      </ResizableSections>
    </aside>
  );
}
