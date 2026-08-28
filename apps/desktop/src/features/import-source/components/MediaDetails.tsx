import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";
import {
  formatBitrate,
  formatBytes,
  formatDuration,
  formatFrameRate,
} from "@/features/import-source/utils/media-formatters";
import type { MediaInfo } from "@/lib/tauri/media";

export function MediaDetails({ media }: { media: MediaInfo | null }) {
  const { t } = useTranslation();
  const noSource = t("import.source.noSource");
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const unknown = media ? t("common.unknown") : noSource;
  const metadata = [
    [
      t("import.source.metadata.container"),
      media ? (media.formatLongName ?? media.formatName) : noSource,
    ],
    [t("import.source.metadata.duration"), media ? formatDuration(media.durationMicros) : noSource],
    [
      t("import.source.metadata.resolution"),
      media ? `${media.video.width} × ${media.video.height}` : noSource,
    ],
    [
      t("import.source.metadata.frameRate"),
      media
        ? formatFrameRate(frameRate, unknown, (value) => t("units.framesPerSecond", { value }))
        : noSource,
    ],
    [
      t("import.source.metadata.videoCodec"),
      media ? media.video.codecName.toUpperCase() : noSource,
    ],
    [
      t("import.source.metadata.fileSize"),
      media ? formatBytes(media.sizeBytes, unknown) : noSource,
    ],
    [
      t("import.source.metadata.bitrate"),
      media
        ? formatBitrate(media.bitrate, unknown, (value) => t("units.megabitsPerSecond", { value }))
        : noSource,
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
