import type { AudioTrackState } from "@/app/session-state";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { AudioStream } from "@/lib/tauri/media";

import { WAVEFORM_RENDER_WIDTH } from "../hooks/use-waveform-preparation";
import { formatChannels } from "../utils/audio-level";
import { waveformStateWidth } from "../utils/waveform";
import { AudioLevelControl } from "./AudioLevelControl";
import { VolumeButton } from "./VolumeButton";
import { WaveformContent } from "./WaveformContent";

interface AudioTrackRowProps {
  stream: AudioStream;
  track: AudioTrackState;
  title: string;
  startPercent: number;
  endPercent: number;
  onToggle: () => void;
  onVolumeChange: (volumePercent: number) => void;
  onPrepareWaveform: (width: number) => void;
  onWaveformImageError: () => void;
}

export function AudioTrackRow({
  stream,
  track,
  title,
  startPercent,
  endPercent,
  onToggle,
  onVolumeChange,
  onPrepareWaveform,
  onWaveformImageError,
}: AudioTrackRowProps) {
  const { t } = useTranslation();
  const [isLevelOpen, setIsLevelOpen] = useState(false);

  return (
    <div className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] gap-3">
      <HoverCard open={isLevelOpen} onOpenChange={setIsLevelOpen} openDelay={0} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div
            className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/40"
            onMouseEnter={() => setIsLevelOpen(true)}
          >
            <VolumeButton
              enabled={track.enabled}
              label={t(track.enabled ? "audio.muteTrack" : "audio.enableTrack", { title })}
              onClick={onToggle}
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold" title={title}>
                {title}
              </p>
              <p className="truncate text-xs leading-5 text-muted-foreground">
                #{stream.streamIndex} · {stream.codecName.toUpperCase()} ·{" "}
                {formatChannels(stream, t)}
              </p>
            </div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[var(--editor-track-controls-width)]"
        >
          <AudioLevelControl
            label={t("audio.trackVolume", { title })}
            volumePercent={track.enabled ? track.volumePercent : 0}
            onChange={onVolumeChange}
          />
        </HoverCardContent>
      </HoverCard>
      <div
        className="relative h-12 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
        data-enabled={track.enabled}
      >
        <WaveformContent
          track={track}
          onRetry={() => onPrepareWaveform(waveformStateWidth(track) || WAVEFORM_RENDER_WIDTH)}
          onImageError={onWaveformImageError}
        />
        <div
          className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/5"
          aria-hidden="true"
          style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
        />
      </div>
    </div>
  );
}
