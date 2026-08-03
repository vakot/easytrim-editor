import type { AudioTrackState } from "@/app/session-state";
import type { AudioStream } from "@/lib/tauri/media";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

import { WAVEFORM_RENDER_WIDTH } from "../hooks/useWaveformPreparation";
import { formatChannels } from "../utils/audio-level";
import { waveformStateWidth } from "../utils/waveform";
import { AudioLevelControl } from "./AudioLevelControl";
import { VolumeButton } from "./VolumeButton";
import { WaveformContent } from "./WaveformContent";

interface AudioTrackRowProps {
  stream: AudioStream;
  track: AudioTrackState;
  title: string;
  onToggle: (streamIndex: number) => void;
  onVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onPrepareWaveform: (streamIndexes: number[], width: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
}

export const AudioTrackRow = memo(function AudioTrackRow({
  stream,
  track,
  title,
  onToggle,
  onVolumeChange,
  onPrepareWaveform,
  onWaveformImageError,
}: AudioTrackRowProps) {
  const { t } = useTranslation();
  const [volumeControlOpen, setVolumeControlOpen] = useState(false);

  return (
    <div
      className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] gap-3"
      data-slot="audio-track-row"
    >
      <div
        className="relative flex min-w-0 items-center gap-2 rounded-lg p-1"
        onPointerEnter={() => setVolumeControlOpen(true)}
        onPointerLeave={() => setVolumeControlOpen(false)}
      >
        <button
          className="absolute inset-0 z-1 rounded-lg"
          type="button"
          aria-label={t("audio.trackVolume", { title })}
          onFocus={() => setVolumeControlOpen(true)}
          onBlur={() => setVolumeControlOpen(false)}
        />
        <VolumeButton
          className="relative z-2"
          enabled={track.enabled}
          label={t(track.enabled ? "audio.muteTrack" : "audio.enableTrack", { title })}
          onClick={() => onToggle(stream.streamIndex)}
          tooltip={false}
        />
        <div className="relative z-0 min-w-0 leading-tight">
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
        {volumeControlOpen ? (
          <div
            className="absolute inset-0 z-1 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
            data-slot="hover-card-content"
          >
            <AudioLevelControl
              label={t("audio.trackVolume", { title })}
              volumePercent={track.enabled ? track.volumePercent : 0}
              onChange={(volumePercent) => onVolumeChange(stream.streamIndex, volumePercent)}
              className="mt-2"
            />
          </div>
        ) : null}
      </div>
      <div
        className="relative h-12 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
        data-enabled={track.enabled}
      >
        <WaveformContent
          track={track}
          onRetry={() =>
            onPrepareWaveform(
              [stream.streamIndex],
              waveformStateWidth(track) || WAVEFORM_RENDER_WIDTH,
            )
          }
          onImageError={() => onWaveformImageError(stream.streamIndex)}
        />
        <div
          className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/5"
          aria-hidden="true"
          style={{
            left: "var(--timeline-trim-start)",
            right: "var(--timeline-trim-end-inset)",
          }}
        />
      </div>
    </div>
  );
});
