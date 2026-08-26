import { useAppSelector } from "@/app/store/hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { PanelSeparator } from "@/components/layout/PanelSeparator";
import {
  ResizableSection,
  ResizableSectionContent,
  ResizableSections,
  ResizableSectionTrigger,
} from "@/components/layout/ResizableSections";
import { Separator } from "@/components/ui/separator";
import { ExportQueue } from "@/features/export";
import { useTranslation } from "react-i18next";
import { ImportedQueue } from "./ImportedQueue";
import { MediaDetails } from "./MediaDetails";

export function SourceSidebar() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);

  return (
    <aside className="h-full min-h-0 min-w-0 flex-col" aria-labelledby="source-title">
      <ResizableSections className="min-h-0 min-w-0 flex-1 px-1 py-2" data-slot="source-sections">
        <ResizableSection
          id="media-details"
          collapsedSize={28}
          defaultSize="15rem"
          minSize="10rem"
          groupResizeBehavior="preserve-relative-size"
        >
          <ResizableSectionTrigger size="sm" variant="ghost" className="px-2">
            {t("import.source.sections.mediaDetails")}
          </ResizableSectionTrigger>
          <ResizableSectionContent className="px-2">
            <MediaDetails media={media} />
          </ResizableSectionContent>
        </ResizableSection>

        <PanelSeparator id="media-details-separator" orientation="horizontal">
          <Separator className="absolute inset-x-2 top-1/2 -translate-y-1/2" />
        </PanelSeparator>

        <ResizableSection
          id="imported-queue"
          collapsedSize={28}
          defaultSize="10rem"
          minSize="7rem"
          groupResizeBehavior="preserve-relative-size"
        >
          <ResizableSectionTrigger size="sm" variant="ghost" className="px-2">
            {t("import.source.sections.importedQueue")}
          </ResizableSectionTrigger>
          <ResizableSectionContent className="px-2">
            <ImportedQueue />
          </ResizableSectionContent>
        </ResizableSection>

        <PanelSeparator id="imported-queue-separator" orientation="horizontal">
          <Separator className="absolute inset-x-2 top-1/2 -translate-y-1/2" />
        </PanelSeparator>

        <ResizableSection
          id="export-queue"
          collapsedSize={28}
          defaultSize="16rem"
          minSize="8rem"
          groupResizeBehavior="preserve-relative-size"
        >
          <ResizableSectionTrigger size="sm" variant="ghost" className="px-2">
            {t("import.source.sections.exportQueue")}
          </ResizableSectionTrigger>
          <ResizableSectionContent className="px-2">
            <ExportQueue />
          </ResizableSectionContent>
        </ResizableSection>
      </ResizableSections>
    </aside>
  );
}
