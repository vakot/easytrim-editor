import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAudioTrackController } from "../../hooks/useAudioTrackController";
import { formatGain } from "../../lib/audio-level.utils";

import { AudioTrackDetails } from "./components/AudioTrackDetails";
import { AudioTrackToggle } from "./components/AudioTrackToggle";
import { AudioTrackWaveform, type WaveformDisplayMode } from "./components/AudioTrackWaveform";

const AudioTrackRow = memo(function AudioTrackRow({ streamIndex }: { streamIndex: number }) {
  const { stream, track } = useAudioTrackController(streamIndex);

  if (!track || !stream) return null;

  return (
    <div
      className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
      data-slot="audio-track-row"
    >
      <div className="flex items-center gap-1">
        <AudioTrackToggle streamIndex={streamIndex} />
        <AudioTrackDetails streamIndex={streamIndex} />
      </div>
      <AudioTrackRowWaveform gainDb={track.processing.gainDb} streamIndex={streamIndex} />
    </div>
  );
});

function AudioTrackRowWaveform({ gainDb, streamIndex }: { gainDb: number; streamIndex: number }) {
  const [displayMode, setDisplayMode] = useState<WaveformDisplayMode>("peak");
  const { stream, track, trackNumber } = useAudioTrackController(streamIndex);
  if (!stream || !track) return null;

  return (
    <div
      className="relative size-full h-12.5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 text-muted transition-opacity data-[enabled=false]:opacity-50"
      data-enabled={track.enabled}
    >
      <AudioTrackWaveform displayMode={displayMode} gainDb={gainDb} stream={stream} track={track} />

      <div className="absolute top-1 right-1 z-4">
        <AudioTrackDisplaySelect
          onValueChange={(value) => setDisplayMode(value as WaveformDisplayMode)}
          streamIndex={streamIndex}
          value={displayMode}
        />
      </div>

      <AudioTrackGainIndicator gainDb={gainDb} trackNumber={trackNumber} />
    </div>
  );
}

function AudioTrackDisplaySelect({
  onValueChange,
  streamIndex,
  value,
}: Pick<React.ComponentProps<typeof Select>, "value" | "onValueChange"> & { streamIndex: number }) {
  const { t } = useTranslation();
  const displayModeShortLabel =
    value === "peak"
      ? t("audio.waveform.displayMode.peakShort")
      : value === "rms"
        ? t("audio.waveform.displayMode.rmsShort")
        : t("audio.waveform.displayMode.stereoShort");

  const displayModeDescription =
    value === "peak"
      ? t("audio.waveform.displayMode.peakDescription")
      : value === "rms"
        ? t("audio.waveform.displayMode.rmsDescription")
        : t("audio.waveform.displayMode.stereoDescription");

  return (
    <>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger
          aria-describedby={`audio-waveform-mode-description-${streamIndex}`}
          aria-label={t("audio.waveform.displayMode.label")}
          className="bg-background/25! text-foreground backdrop-blur-xs"
          size="sm"
        >
          <SelectValue>{displayModeShortLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="peak">
            {t("audio.waveform.displayMode.peakShort")}
            <span className="text-muted-foreground!">
              {t("audio.waveform.displayMode.peakDescription")}
            </span>
          </SelectItem>
          <SelectItem value="rms">
            {t("audio.waveform.displayMode.rmsShort")}
            <span className="text-muted-foreground!">
              {t("audio.waveform.displayMode.rmsDescription")}
            </span>
          </SelectItem>
          <SelectItem value="stereo">
            {t("audio.waveform.displayMode.stereoShort")}
            <span className="text-muted-foreground!">
              {t("audio.waveform.displayMode.stereoDescription")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <span className="sr-only" id={`audio-waveform-mode-description-${streamIndex}`}>
        {displayModeDescription}
      </span>
    </>
  );
}

function AudioTrackGainIndicator({ gainDb, trackNumber }: { gainDb: number; trackNumber: number }) {
  const { i18n, t } = useTranslation();

  return (
    <Badge
      aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
      className="absolute bottom-1 left-1 z-3 max-w-[calc(100%-0.5rem)] gap-1.5 bg-background/25 backdrop-blur-xs"
      data-slot="audio-track-gain-indicator"
      size="xs"
      variant="outline"
    >
      {formatGain(gainDb, i18n.language)}
    </Badge>
  );
}

export { AudioTrackRow };
