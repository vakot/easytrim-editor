import type { MediaInfo } from "@/lib/tauri/media";
import {
  formatBitrate,
  formatBytes,
  formatDuration,
  formatFrameRate,
} from "@/features/import-source/utils/media-formatters";

export function MediaDetails({ media }: { media: MediaInfo }) {
  const frameRate = media.video.averageFrameRate ?? media.video.realFrameRate;
  const metadata = [
    ["Container", media.formatLongName ?? media.formatName],
    ["Duration", formatDuration(media.durationMicros)],
    ["Resolution", `${media.video.width} × ${media.video.height}`],
    ["Frame rate", formatFrameRate(frameRate)],
    ["Video codec", media.video.codecName.toUpperCase()],
    ["File size", formatBytes(media.sizeBytes)],
    ["Bitrate", formatBitrate(media.bitrate)],
    ["Video stream", `#${media.video.streamIndex}`],
    ["Audio tracks", String(media.audioStreams.length)],
  ] as const;

  return (
    <dl className="grid gap-1" aria-label="Video metadata">
      {metadata.map(([label, value]) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-border/55 py-2 last:border-0"
          key={label}
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd
            className="max-w-40 truncate text-right text-xs font-medium text-foreground"
            title={value}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
