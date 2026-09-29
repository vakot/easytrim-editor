import type { CSSProperties } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";

import { useAppSelector } from "@/app/store/redux-hooks";
import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { timelinePercent } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media.types";

import { formatChannels } from "../../lib/audio-level.utils";

import { AudioTrackActions } from "./components/AudioTrackActions";
import { AudioTrackToggle } from "./components/AudioTrackToggle";
import { AudioTrackWaveform } from "./components/AudioTrackWaveform";

interface AudioTrackRowProps {
  stream: AudioStream;
  track: AudioTrackState;
  trackColor: string;
  trackNumber: number;
}

const AudioTrackRow = memo(function AudioTrackRow({
  stream,
  track,
  trackColor,
  trackNumber,
}: AudioTrackRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
          data-slot="audio-track-row"
          style={{ "--audio-track-color": trackColor } as CSSProperties}
        >
          <AudioTrackRowDetails
            stream={stream}
            track={track}
            trackColor={trackColor}
            trackNumber={trackNumber}
          />
          <AudioTrackRowWaveform
            stream={stream}
            track={track}
            trackColor={trackColor}
            trackNumber={trackNumber}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <AudioTrackActions mode="context" stream={stream} track={track} trackNumber={trackNumber} />
      </ContextMenuContent>
    </ContextMenu>
  );
});

function AudioTrackRowDetails({ stream, track, trackNumber }: AudioTrackRowProps) {
  const { t } = useTranslation();

  const title =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  return (
    <div className="flex items-center gap-1">
      <AudioTrackToggle stream={stream} track={track} />

      <div className="relative min-w-0 flex-1">
        <div className="leading-tight">
          <p
            className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
            data-enabled={track.enabled}
          >
            {title}
          </p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            #{trackNumber} · {stream.codecName.toUpperCase()} · {formatChannels(stream, t)}
          </p>
        </div>
      </div>

      <AudioTrackActions stream={stream} track={track} trackNumber={trackNumber} />
    </div>
  );
}

function AudioTrackRowWaveform({ stream, track, trackColor }: AudioTrackRowProps) {
  const trim = useAppSelector(selectTrim);
  const activityRanges =
    track.activityAnalysis.status === "ready" && track.activityVisible
      ? track.activityAnalysis.value
      : [];

  return (
    <div
      className="relative h-12.5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
      data-enabled={track.enabled}
    >
      <AudioTrackWaveform stream={stream} track={track} />
      {activityRanges.map((range) => (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-1"
          data-slot="audio-track-activity-range"
          key={`${range.startMicros}-${range.endMicros}`}
          style={{
            backgroundColor: trackColor,
            left: `${timelinePercent(range.startMicros, trim?.sourceDurationMicros ?? 1)}%`,
            opacity: 0.22,
            right: `${100 - timelinePercent(range.endMicros, trim?.sourceDurationMicros ?? 1)}%`,
          }}
        />
      ))}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/5"
        style={{
          left: "var(--timeline-trim-start)",
          right: "var(--timeline-trim-end-inset)",
        }}
      />
    </div>
  );
}

export { AudioTrackRow };
