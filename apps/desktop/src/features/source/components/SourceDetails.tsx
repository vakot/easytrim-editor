import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";

import {
  formatBitrate,
  formatBytes,
  formatDuration,
  formatFrameRate,
} from "../lib/media-formatters.utils";

export function SourceDetails() {
  const media = useAppSelector(selectSourceMedia);
  const source = useAppSelector(selectSourceSelection);
  const { t } = useTranslation();
  const noSource = t("source.messages.noSource");
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const unknown = media ? t("common.status.unknown") : noSource;
  const metadata = [
    [t("source.labels.metadata.filename"), source ? source.displayName : noSource],
    [
      t("source.labels.metadata.container"),
      media ? (media.formatLongName ?? media.formatName) : noSource,
    ],
    [t("source.labels.metadata.duration"), media ? formatDuration(media.durationMicros) : noSource],
    [
      t("source.labels.metadata.resolution"),
      media ? `${media.video.width} \u00d7 ${media.video.height}` : noSource,
    ],
    [
      t("source.labels.metadata.frameRate"),
      media
        ? formatFrameRate(frameRate, unknown, (value) =>
            t("units.labels.framesPerSecond", { value }),
          )
        : noSource,
    ],
    [
      t("source.labels.metadata.videoCodec"),
      media ? media.video.codecName.toUpperCase() : noSource,
    ],
    [
      t("source.labels.metadata.fileSize"),
      media ? formatBytes(media.sizeBytes, unknown) : noSource,
    ],
    [
      t("source.labels.metadata.bitrate"),
      media
        ? formatBitrate(media.bitrate, unknown, (value) =>
            t("units.labels.megabitsPerSecond", { value }),
          )
        : noSource,
    ],
  ] as const;

  return (
    <dl aria-label={t("source.accessibility.metadata")}>
      {metadata.map(([label, value], index) => (
        <Fragment key={label}>
          <div className="grid w-full grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>

            <dd className="truncate text-right text-xs font-medium text-foreground" title={value}>
              {value}
            </dd>
          </div>

          {index < metadata.length - 1 ? <Separator className="bg-border/55" /> : null}
        </Fragment>
      ))}
    </dl>
  );
}
