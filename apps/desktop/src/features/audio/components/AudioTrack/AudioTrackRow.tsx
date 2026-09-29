import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import type { AudioStream } from "@/lib/tauri/media.types";

import { formatChannels } from "../../lib/audio-level.utils";

import { AudioTrackActions } from "./components/AudioTrackActions";
import { AudioTrackToggle } from "./components/AudioTrackToggle";
import { AudioTrackWaveform } from "./components/AudioTrackWaveform";

interface AudioTrackRowProps {
  stream: AudioStream;
  track: AudioTrackState;
}

const AudioTrackRow = memo(function AudioTrackRow({ stream, track }: AudioTrackRowProps) {
  return (
    <div
      className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
      data-slot="audio-track-row"
    >
      <AudioTrackRowDetails stream={stream} track={track} />
      <AudioTrackRowWaveform stream={stream} track={track} />
    </div>
  );
});

function AudioTrackRowDetails({ stream, track }: AudioTrackRowProps) {
  const { t } = useTranslation();

  const title =
    stream.title ??
    stream.language ??
    t("audio.labels.defaultTrack", { number: stream.streamIndex });

  return (
    <div className="flex items-center gap-1">
      <AudioTrackToggle stream={stream} track={track} />

      <div className="relative min-w-0 flex-1">
        <div className="leading-tight opacity-100 transition-opacity duration-150 data-[controls-visible=true]:opacity-0">
          <p
            className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
            data-enabled={track.enabled}
          >
            {title}
          </p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            #{stream.streamIndex} · {stream.codecName.toUpperCase()} · {formatChannels(stream, t)}
          </p>
        </div>
      </div>

      <AudioTrackActions stream={stream} track={track} />
    </div>
  );
}

function AudioTrackRowWaveform({ stream, track }: AudioTrackRowProps) {
  return (
    <div
      className="relative h-12.5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
      data-enabled={track.enabled}
    >
      <AudioTrackWaveform stream={stream} track={track} />
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
