import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioFilterPreview } from "@/app/store/slices/audio-slice";
import {
  audioSyncOffsetRange,
  audioTimelineBoundaries,
  effectiveAudioOffsetMicros,
} from "@/domain/audio-processing";
import { useTimelinePlayback } from "@/features/playback";

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
import { AudioTrackFiltersShortcut } from "./components/AudioTrackFiltersShortcut";
import { AudioTrackToggle } from "./components/AudioTrackToggle";
import { AudioTrackVolumeControl } from "./components/AudioTrackVolumeControl";
import { AudioTrackWaveform } from "./components/AudioTrackWaveform";
import {
  AudioTrackDisplayModeContext,
  useAudioTrackDisplayMode,
} from "./contexts/audio-track-display-mode-context";

const AudioTrackRow = memo(function AudioTrackRow({ streamIndex }: { streamIndex: number }) {
  const { stream, track, trackNumber } = useAudioTrackController(streamIndex);
  // The volume being adjusted, shown in the track volume indicator before it is committed.
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
  const { t } = useTranslation();
  const { changeSyncOffset, durationMicros, stream, track, trackColor, trackNumber } =
    useAudioTrackController(streamIndex);

  const filterPreview = useAppSelector(selectAudioFilterPreview);
  const { getPositionMicros } = useTimelinePlayback();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  const [syncMarker, setSyncMarker] = useState<{
    leftPercent: number;
    offsetMicros: number;
  } | null>(null);

  const shouldReduceMotion = useReducedMotion() === true;

  if (!stream || !track) return null;

  const volume = liveVolume ?? track.processing.volume;
  const activityRanges =
    track.activityVisible && track.activityAnalysis.status === "ready"
      ? track.activityAnalysis.value
      : [];

  const hasOffsetPreview = filterPreview?.streamIndex === streamIndex;
  const syncOffset = hasOffsetPreview ? filterPreview.syncOffset : track.processing.syncOffset;

  const audioBoundaries = audioTimelineBoundaries(
    durationMicros,
    stream.startTimeMicros,
    stream.durationMicros,
    syncOffset ?? undefined,
  );

  const syncOffsetRange = audioSyncOffsetRange(
    durationMicros,
    stream.startTimeMicros,
    stream.durationMicros,
  );

  const unavailableRanges = getUnavailableAudioRanges(audioBoundaries, durationMicros);

  return (
    <div
      className="relative size-full h-12.5 min-w-0 overflow-hidden rounded-sm border border-border bg-muted/30 text-muted transition-opacity first-of-type:rounded-t-lg last-of-type:rounded-b-lg data-[enabled=false]:opacity-50"
      data-enabled={track.enabled}
      data-slot="audio-sync-interaction"
      onClick={(event) => {
        if (event.button !== 0) return;
        if (
          event.target instanceof Element &&
          event.target.closest("button, input, select, textarea, a, [role='button']")
        ) {
          return;
        }
        if (!(event.target instanceof Element) || !event.target.closest("canvas")) return;

        const position = waveformPosition(event.clientX, event.currentTarget, durationMicros);
        if (!position || !isAudioPositionAvailable(position.micros, audioBoundaries)) return;

        const currentOffsetMicros = effectiveAudioOffsetMicros(syncOffset ?? undefined);
        const offsetMicros = Math.max(
          syncOffsetRange.minOffsetMicros,
          Math.min(
            syncOffsetRange.maxOffsetMicros,
            Math.round(getPositionMicros() + currentOffsetMicros - position.micros),
          ),
        );

        setHoveredPosition(null);
        setSyncMarker({ leftPercent: position.leftPercent, offsetMicros });
      }}
      onPointerLeave={() => setHoveredPosition(null)}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        if (
          event.target instanceof Element &&
          event.target.closest("button, input, select, textarea, a, [role='button']")
        ) {
          setHoveredPosition(null);
          return;
        }

        const position = waveformPosition(event.clientX, event.currentTarget, durationMicros);
        setHoveredPosition(
          position && isAudioPositionAvailable(position.micros, audioBoundaries)
            ? position.leftPercent
            : null,
        );
      }}
    >
      <div className="absolute inset-0">
        <AudioTrackWaveform
          displayMode={displayMode}
          stream={stream}
          syncOffset={hasOffsetPreview ? syncOffset : undefined}
          timelineDurationMicros={durationMicros}
          track={track}
          volume={volume}
        />
      </div>

      <div className="pointer-events-none absolute inset-0">
        {hoveredPosition !== null && syncMarker === null ? (
          <Tooltip open>
            <TooltipTrigger asChild>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/50 shadow-[0_0_3px_rgb(0_0_0/0.5)]"
                data-slot="audio-sync-ghost-playhead"
                style={{ left: `${hoveredPosition}%` }}
              />
            </TooltipTrigger>
            <TooltipContent className="pointer-events-none" side="top" sideOffset={6}>
              {t("audio.syncOffset.label")}
            </TooltipContent>
          </Tooltip>
        ) : null}

        <Popover
          onOpenChange={(open) => {
            if (!open) setSyncMarker(null);
          }}
          open={syncMarker !== null}
        >
          {syncMarker ? (
            <PopoverAnchor asChild>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-px bg-primary shadow-[0_0_4px_var(--primary)]"
                data-slot="audio-sync-temporary-marker"
                style={{ left: `${syncMarker.leftPercent}%` }}
              />
            </PopoverAnchor>
          ) : null}
          <PopoverContent
            align="center"
            className="w-auto min-w-44 p-2"
            onClick={(event) => event.stopPropagation()}
            onFocusOutside={() => setSyncMarker(null)}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              confirmButtonRef.current?.focus();
            }}
            side="top"
            sideOffset={6}
          >
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (!syncMarker) return;
                  changeSyncOffset({ enabled: true, offsetMicros: syncMarker.offsetMicros });
                  setSyncMarker(null);
                }}
                ref={confirmButtonRef}
                size="sm"
                type="button"
              >
                {t("audio.syncOffset.confirm")}
              </Button>
              <Button onClick={() => setSyncMarker(null)} size="sm" type="button" variant="ghost">
                {t("common.actions.cancel")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
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

      {unavailableRanges.map(({ key, leftPercent, rightPercent }) => (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-2 transition-[left,right] duration-100 ease-out motion-reduce:transition-none"
          data-slot="audio-unavailable-region"
          key={key}
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(15 23 42 / 82%) 0 4px, rgb(30 41 59 / 82%) 4px 8px)",
            left: `${leftPercent}%`,
            right: `${rightPercent}%`,
          }}
        />
      ))}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-(--timeline-selection-end-inset) left-(--timeline-selection-start) border-x border-primary/70 bg-primary/5"
        data-slot="audio-track-selection"
      />
      <AudioTrackVolumeIndicator trackNumber={trackNumber} volume={volume} />

      <div className="absolute top-0 left-0 z-4">
        <AudioTrackFiltersShortcut streamIndex={streamIndex} />
      </div>
    </div>
  );
}

const ACTIVITY_RANGE_OPACITY = 0.1;

function percentOfDuration(micros: number, durationMicros: number) {
  return (Math.max(0, Math.min(durationMicros, micros)) / durationMicros) * 100;
}

function getUnavailableAudioRanges(
  boundaries: ReturnType<typeof audioTimelineBoundaries>,
  durationMicros: number,
) {
  if (durationMicros <= 0) return [];
  if (!boundaries.hasVisibleAudio) {
    return [{ key: "all", leftPercent: 0, rightPercent: 0 }];
  }

  const start = percentOfDuration(boundaries.visibleStartMicros, durationMicros);
  const end = percentOfDuration(boundaries.visibleEndMicros, durationMicros);
  return [
    ...(start > 0 ? [{ key: "before", leftPercent: 0, rightPercent: 100 - start }] : []),
    ...(end < 100 ? [{ key: "after", leftPercent: end, rightPercent: 0 }] : []),
  ];
}

function waveformPosition(clientX: number, element: HTMLElement, durationMicros: number) {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || durationMicros <= 0) return null;

  const x = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
  const ratio = x / bounds.width;
  return { leftPercent: ratio * 100, micros: Math.round(ratio * durationMicros) };
}

function isAudioPositionAvailable(
  micros: number,
  boundaries: ReturnType<typeof audioTimelineBoundaries>,
) {
  return (
    boundaries.hasVisibleAudio &&
    micros >= boundaries.effectiveStartMicros &&
    micros < boundaries.effectiveEndMicros
  );
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
