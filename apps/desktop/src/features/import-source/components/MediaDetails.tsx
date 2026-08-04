import { Fragment } from "react";

import { Separator } from "@/components/ui/separator";
import type { MediaInfo } from "@/lib/tauri/media";
import {
  formatBitrate,
  formatBytes,
  formatDuration,
  formatFrameRate,
} from "@/features/import-source/utils/media-formatters";
import { useTranslation } from "react-i18next";

export function MediaDetails({ media }: { media: MediaInfo }) {
  const { t } = useTranslation();
  const frameRate = media.video.averageFrameRate ?? media.video.realFrameRate;
  const unknown = t("common.unknown");
  const metadata = [
    [t("import.source.metadata.container"), media.formatLongName ?? media.formatName],
    [t("import.source.metadata.duration"), formatDuration(media.durationMicros)],
    [t("import.source.metadata.resolution"), `${media.video.width} × ${media.video.height}`],
    [
      t("import.source.metadata.frameRate"),
      formatFrameRate(frameRate, unknown, (value) => t("units.framesPerSecond", { value })),
    ],
    [t("import.source.metadata.videoCodec"), media.video.codecName.toUpperCase()],
    [t("import.source.metadata.fileSize"), formatBytes(media.sizeBytes, unknown)],
    [
      t("import.source.metadata.bitrate"),
      formatBitrate(media.bitrate, unknown, (value) => t("units.megabitsPerSecond", { value })),
    ],
  ] as const;

  return (
    <dl className="grid" aria-label={t("import.source.metadataLabel")}>
      {metadata.map(([label, value], index) => (
        <Fragment key={label}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="max-w-40 truncate text-right text-xs font-medium text-foreground">
              {value}
            </dd>
          </div>
          {index < metadata.length - 1 ? <Separator className="bg-border/55" /> : null}
        </Fragment>
      ))}
    </dl>
  );
}
