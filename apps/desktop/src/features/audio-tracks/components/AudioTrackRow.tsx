import type { AudioTrackState } from "@/app/session-state";
import { Card } from "@/components/ui/card";
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
  const volumeButtonProps = {
    enabled: track.enabled,
    label: t(track.enabled ? "audio.muteTrack" : "audio.enableTrack", { title }),
    onClick: () => onToggle(stream.streamIndex),
    tooltip: false,
  };

  return (
    <div
      className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] gap-3"
      data-slot="audio-track-row"
    >
      <div
        className="relative min-w-0"
        onPointerEnter={() => setVolumeControlOpen(true)}
        onPointerLeave={() => setVolumeControlOpen(false)}
      >
        <HoverCard
          open={volumeControlOpen}
          onOpenChange={(open) => {
            if (open) setVolumeControlOpen(true);
          }}
        >
          <HoverCardTrigger asChild>
            <Card className="relative flex flex-row items-center gap-2 bg-transparent p-1 pr-2 ring-0 transition-colors duration-100">
              <VolumeButton {...volumeButtonProps} className="relative z-2" />
              <div className="min-w-0 leading-tight">
                <p
                  className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
                  data-enabled={track.enabled}
                >
                  {title}
                </p>
                <p className="truncate text-xs leading-5 text-muted-foreground">
                  #{stream.streamIndex} · {stream.codecName.toUpperCase()} ·{" "}
                  {formatChannels(stream, t)}
                </p>
              </div>
            </Card>
          </HoverCardTrigger>
          <HoverCardContent
            portalled={false}
            className="!absolute !inset-0 !z-1 !min-w-0 !w-auto !transform-none flex flex-row items-center gap-2 rounded-xl bg-card p-1 pr-2 text-card-foreground"
          >
            <div className="size-7 shrink-0" aria-hidden="true" />
            <AudioLevelControl
              label={t("audio.trackVolume", { title })}
              volumePercent={track.enabled ? track.volumePercent : 0}
              onChange={(volumePercent) => onVolumeChange(stream.streamIndex, volumePercent)}
              className="flex-1"
            />
          </HoverCardContent>
        </HoverCard>
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
