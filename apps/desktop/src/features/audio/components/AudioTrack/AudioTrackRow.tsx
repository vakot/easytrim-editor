import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AudioTrackFiltersDialog } from "../../dialogs/AudioTrackFiltersDialog";
import { AudioTrackMetadataDialog } from "../../dialogs/AudioTrackMetadataDialog";
import { useAudioTrackController } from "../../hooks/useAudioTrackController";
import { formatTrackVolume } from "../../lib/audio-level.utils";
import {
  isWaveformDisplayMode,
  WAVEFORM_DISPLAY_MODES,
  type WaveformDisplayMode,
  waveformDisplayModeDescription,
  waveformDisplayModeLabel,
} from "../../lib/waveform-display-mode";

import { AudioTrackActions, AudioTrackContextMenuContent } from "./components/AudioTrackActions";
import { AudioTrackDetails } from "./components/AudioTrackDetails";
import { AudioTrackToggle } from "./components/AudioTrackToggle";
import { AudioTrackVolumeControl } from "./components/AudioTrackVolumeControl";
import { AudioTrackWaveform } from "./components/AudioTrackWaveform";
import {
  AudioTrackDisplayModeContext,
  useAudioTrackDisplayMode,
} from "./contexts/audio-track-display-mode-context";

const AudioTrackRow = memo(function AudioTrackRow({ streamIndex }: { streamIndex: number }) {
  const { stream, track, trackNumber } = useAudioTrackController(streamIndex);
  // The volume being adjusted, previewed on the waveform before it is committed.
  const [liveVolume, setLiveVolume] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<WaveformDisplayMode>("peak");
  const displayModeContext = useMemo(() => ({ displayMode, setDisplayMode }), [displayMode]);

  if (!track || !stream) return null;

  return (
    <AudioTrackDisplayModeContext.Provider value={displayModeContext}>
      <AudioTrackMetadataDialog streamIndex={streamIndex}>
        <AudioTrackFiltersDialog streamIndex={streamIndex}>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
                data-slot="audio-track-row"
              >
                <div className="flex items-center gap-1">
                  <HoverCard closeDelay={100} openDelay={0} preserveOnTrigger>
                    <HoverCardTrigger>
                      <AudioTrackToggle streamIndex={streamIndex} />
                    </HoverCardTrigger>

                    <HoverCardContent align="center" className="max-w-42 p-0" side="right">
                      <AudioTrackVolumeControl
                        onLiveVolumeChange={setLiveVolume}
                        streamIndex={streamIndex}
                        trackNumber={trackNumber}
                      />
                    </HoverCardContent>
                  </HoverCard>

                  <AudioTrackDetails streamIndex={streamIndex} />
                  <AudioTrackActions streamIndex={streamIndex} />
                </div>
                <AudioTrackRowWaveform liveVolume={liveVolume} streamIndex={streamIndex} />
              </div>
            </ContextMenuTrigger>

            <AudioTrackContextMenuContent streamIndex={streamIndex} />
          </ContextMenu>
        </AudioTrackFiltersDialog>
      </AudioTrackMetadataDialog>
    </AudioTrackDisplayModeContext.Provider>
  );
});

function AudioTrackRowWaveform({
  liveVolume,
  streamIndex,
}: {
  liveVolume: number | null;
  streamIndex: number;
}) {
  const { displayMode } = useAudioTrackDisplayMode();
  const { durationMicros, stream, track, trackColor, trackNumber } =
    useAudioTrackController(streamIndex);

  const shouldReduceMotion = useReducedMotion() === true;

  if (!stream || !track) return null;

  const volume = liveVolume ?? track.processing.volume;
  const activityRanges =
    track.activityVisible && track.activityAnalysis.status === "ready"
      ? track.activityAnalysis.value
      : [];

  return (
    <div
      className="relative size-full h-12.5 min-w-0 overflow-hidden rounded-sm border border-border bg-muted/30 text-muted transition-opacity first-of-type:rounded-t-lg last-of-type:rounded-b-lg data-[enabled=false]:opacity-50"
      data-enabled={track.enabled}
    >
      <AudioTrackWaveform displayMode={displayMode} stream={stream} track={track} volume={volume} />

      <div className="absolute top-1 right-1 z-4">
        <AudioTrackDisplaySelect streamIndex={streamIndex} />
      </div>

      {/* Ranges present when the row mounts appear without animating; later ones fade in and out. */}
      <AnimatePresence initial={false}>
        {durationMicros > 0 &&
          activityRanges.map((range) => (
            <motion.div
              animate={{ opacity: ACTIVITY_RANGE_OPACITY, scaleY: 1 }}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-1"
              data-slot="audio-track-activity-range"
              exit={{ opacity: 0, scaleY: 0 }}
              initial={{ opacity: 0, scaleY: 0 }}
              key={`${range.startMicros}-${range.endMicros}`}
              style={{
                backgroundColor: trackColor,
                left: `${percentOfDuration(range.startMicros, durationMicros)}%`,
                opacity: ACTIVITY_RANGE_OPACITY,
                right: `${100 - percentOfDuration(range.endMicros, durationMicros)}%`,
              }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-(--timeline-selection-end-inset) left-(--timeline-selection-start) border-x border-primary/70 bg-primary/5"
        data-slot="audio-track-selection"
      />
      <AudioTrackVolumeIndicator trackNumber={trackNumber} volume={volume} />
    </div>
  );
}

const ACTIVITY_RANGE_OPACITY = 0.1;

function percentOfDuration(micros: number, durationMicros: number) {
  return (Math.max(0, Math.min(durationMicros, micros)) / durationMicros) * 100;
}

function AudioTrackDisplaySelect({ streamIndex }: { streamIndex: number }) {
  const { t } = useTranslation();
  const { displayMode, setDisplayMode } = useAudioTrackDisplayMode();

  return (
    <>
      <Select
        onValueChange={(value) => {
          if (isWaveformDisplayMode(value)) setDisplayMode(value);
        }}
        value={displayMode}
      >
        <SelectTrigger
          aria-describedby={`audio-waveform-mode-description-${streamIndex}`}
          aria-label={t("audio.waveform.displayMode.label")}
          className="bg-background/25! text-foreground backdrop-blur-xs"
          size="sm"
        >
          <SelectValue>{waveformDisplayModeLabel(displayMode, t)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {WAVEFORM_DISPLAY_MODES.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {waveformDisplayModeLabel(mode, t)}
              <span className="text-muted-foreground!">
                {waveformDisplayModeDescription(mode, t)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="sr-only" id={`audio-waveform-mode-description-${streamIndex}`}>
        {waveformDisplayModeDescription(displayMode, t)}
      </span>
    </>
  );
}

function AudioTrackVolumeIndicator({
  trackNumber,
  volume,
}: {
  trackNumber: number;
  volume: number;
}) {
  const { i18n, t } = useTranslation();

  return (
    <Badge
      aria-label={t("audio.tracks.volumeLabel", { number: trackNumber })}
      className="absolute bottom-1 left-1 z-3 max-w-[calc(100%-0.5rem)] gap-1.5 bg-background/25 backdrop-blur-xs"
      data-slot="audio-track-volume-indicator"
      size="xs"
      variant="outline"
    >
      {formatTrackVolume(volume, i18n.language)}
    </Badge>
  );
}

export { AudioTrackRow };
