import { useTranslation } from "react-i18next";

import { RelativeTimestamp } from "@/components/ui/relative-timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

import { formatBytes } from "../../../lib/media-formatters.utils";
import { useSourceCardData } from "../hooks/useSourceCardData";

function SourceCardMetadata({ className }: { className?: string }) {
  const source = useSourceCardData();
  const { t } = useTranslation();
  const unknown = t("common.status.unknown");
  const fileSize = formatBytes(source.snapshot.source.fileSizeBytes, unknown);

  return (
    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help truncate focus-visible:outline-none" tabIndex={0}>
            {fileSize}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("source.labels.metadata.fileSize")}: {fileSize}
        </TooltipContent>
      </Tooltip>
      <span aria-hidden="true">·</span>
      <RelativeTimestamp
        label={t("source.labels.metadata.updatedAt")}
        timestamp={source.snapshot.source.updatedAtMicros}
      />
    </div>
  );
}

export { SourceCardMetadata };
