import type { ReactNode } from "react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { RelativeTimestamp } from "@/components/ui/relative-timestamp";
import { Separator } from "@/components/ui/separator";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";

import {
  formatBitrate,
  formatBytes,
  formatDuration,
  formatFrameRate,
} from "../lib/media-formatters.utils";

function SourceDetails() {
  const media = useAppSelector(selectSourceMedia);
  const source = useAppSelector(selectSourceSelection);
  const { t } = useTranslation();
  const noSource = t("source.info.noSourceSelected");
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const unknown = media ? t("common.unknown") : noSource;
  const metadata: readonly [string, ReactNode][] = [
    [t("source.metadata.filename"), source ? source.displayName : noSource],
    [
      t("source.metadata.createdAt"),
      source ? (
        <RelativeTimestamp
          label={t("source.metadata.createdAt")}
          timestamp={source.createdAtMicros}
        />
      ) : (
        noSource
      ),
    ],
    [
      t("source.metadata.updatedAt"),
      source ? (
        <RelativeTimestamp
          label={t("source.metadata.updatedAt")}
          timestamp={source.updatedAtMicros}
        />
      ) : (
        noSource
      ),
    ],
    [t("source.metadata.container"), media ? (media.formatLongName ?? media.formatName) : noSource],
    [t("source.metadata.duration"), media ? formatDuration(media.durationMicros) : noSource],
    [
      t("source.metadata.resolution"),
      media ? `${media.video.width} \u00d7 ${media.video.height}` : noSource,
    ],
    [
      t("source.metadata.frameRate"),
      media
        ? formatFrameRate(frameRate, unknown, (value) => t("units.framesPerSecond", { value }))
        : noSource,
    ],
    [t("source.metadata.videoCodec"), media ? media.video.codecName.toUpperCase() : noSource],
    [t("source.metadata.fileSize"), media ? formatBytes(media.sizeBytes, unknown) : noSource],
    [
      t("source.metadata.bitrate"),
      media
        ? formatBitrate(media.bitrate, unknown, (value) => t("units.megabitsPerSecond", { value }))
        : noSource,
    ],
  ] as const;

  return (
    <dl aria-label={t("source.metadata.accessibleLabel")}>
      {metadata.map(([label, value], index) => (
        <Fragment key={label}>
          <div className="grid w-full grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>

            <dd
              className="truncate text-right text-xs font-medium text-foreground"
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </dd>
          </div>

          {index < metadata.length - 1 ? <Separator className="bg-border/55" /> : null}
        </Fragment>
      ))}
    </dl>
  );
}

export { SourceDetails };
