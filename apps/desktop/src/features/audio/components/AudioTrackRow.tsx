import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import type { AudioStream } from "@/lib/tauri/media.types";

import { WAVEFORM_RENDER_WIDTH } from "../hooks/useWaveformPreparation";
import { formatChannels } from "../lib/audio-level.utils";

import { AudioLevelControl } from "./AudioLevelControl";
import { VolumeButton } from "./VolumeButton";
import { WaveformContent } from "./WaveformContent";

function waveformStateWidth(track: AudioTrackState): number | null {
  return track.waveform.status === "idle" ? null : track.waveform.width;
}

interface AudioTrackRowProps {
  onCommit: () => void;
  onPrepareWaveform: (streamIndexes: number[], width: number) => void;
  onToggle: (streamIndex: number) => void;
  onVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
  stream: AudioStream;
  title: string;
  track: AudioTrackState;
}

export const AudioTrackRow = memo(function AudioTrackRow({
  onCommit,
  onPrepareWaveform,
  onToggle,
  onVolumeChange,
  onWaveformImageError,
  stream,
  title,
  track,
}: AudioTrackRowProps) {
  const { t } = useTranslation();
  const [controlsVisible, setControlsVisible] = useState(false);

  return (
    <div
      className="grid min-w-0 grid-cols-(--editor-audio-track-grid-columns) gap-3"
      data-slot="audio-track-row"
    >
      <Card
        className="relative flex flex-row items-center gap-2 bg-transparent p-1 pr-2 ring-transparent transition-[background-color,box-shadow] duration-150 ring-inset data-[controls-visible=true]:bg-card data-[controls-visible=true]:ring-foreground/10"
        data-controls-visible={controlsVisible}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setControlsVisible(false);
        }}
        onFocusCapture={() => setControlsVisible(true)}
        onPointerEnter={() => setControlsVisible(true)}
        onPointerLeave={() => setControlsVisible(false)}
      >
        <VolumeButton
          enabled={track.enabled}
          label={
            track.enabled
              ? t("audio.actions.muteTrack", { title })
              : t("audio.actions.enableTrack", { title })
          }
          onClick={() => onToggle(stream.streamIndex)}
        />
        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden={controlsVisible}
            className="leading-tight opacity-100 transition-opacity duration-150 data-[controls-visible=true]:opacity-0"
            data-controls-visible={controlsVisible}
          >
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
          <div
            aria-hidden={!controlsVisible}
            className="pointer-events-none absolute inset-0 flex items-center opacity-0 transition-opacity duration-150 data-[controls-visible=true]:pointer-events-auto data-[controls-visible=true]:opacity-100"
            data-controls-visible={controlsVisible}
            inert={!controlsVisible}
          >
            <AudioLevelControl
              className="mt-2"
              label={t("audio.accessibility.trackVolume", { title })}
              onChange={(volumePercent) => onVolumeChange(stream.streamIndex, volumePercent)}
              onCommit={onCommit}
              volumePercent={track.enabled ? track.volumePercent : 0}
            />
          </div>
        </div>
      </Card>
      <div
        className="relative h-12.5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
        data-enabled={track.enabled}
      >
        <WaveformContent
          onImageError={() => onWaveformImageError(stream.streamIndex)}
          onRetry={() =>
            onPrepareWaveform(
              [stream.streamIndex],
              waveformStateWidth(track) || WAVEFORM_RENDER_WIDTH,
            )
          }
          track={track}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/5"
          style={{
            left: "var(--timeline-trim-start)",
            right: "var(--timeline-trim-end-inset)",
          }}
        />
      </div>
    </div>
  );
});
