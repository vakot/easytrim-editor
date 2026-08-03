import type { AudioTrackState } from "@/app/session-state";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
      <HoverCard
        open={volumeControlOpen}
        onOpenChange={(open) => {
          if (open) setVolumeControlOpen(true);
        }}
      >
        <div className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1">
          <HoverCardTrigger asChild>
            <VolumeButton
              enabled={track.enabled}
              label={t(track.enabled ? "audio.muteTrack" : "audio.enableTrack", { title })}
              onClick={() => onToggle(stream.streamIndex)}
              tooltip={false}
              onPointerEnter={() => setVolumeControlOpen(true)}
              onPointerLeave={() => setVolumeControlOpen(false)}
              onFocus={() => setVolumeControlOpen(true)}
              onBlur={() => setVolumeControlOpen(false)}
            />
          </HoverCardTrigger>
          <div className="min-w-0 leading-tight">
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
        <HoverCardContent
          side="right"
          align="center"
          sideOffset={4}
          className="w-[calc(var(--editor-track-controls-width)-1.5rem)] px-3 py-1"
        >
          <AudioLevelControl
            label={t("audio.trackVolume", { title })}
            volumePercent={track.enabled ? track.volumePercent : 0}
            onChange={(volumePercent) => onVolumeChange(stream.streamIndex, volumePercent)}
            className="mt-2"
          />
        </HoverCardContent>
      </HoverCard>
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
