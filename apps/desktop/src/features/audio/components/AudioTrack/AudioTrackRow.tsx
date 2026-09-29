import { WandSparkles } from "lucide-react";
import { type CSSProperties, memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Slider } from "@/components/ui/slider";

import { useAppSelector } from "@/app/store/redux-hooks";
import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AudioTrackProcessing } from "@/domain/audio-processing";
import { timelinePercent } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media.types";

import type { AudioTrackController } from "../../hooks/useAudioTrackController";
import { useAudioTrackController } from "../../hooks/useAudioTrackController";
import { formatChannels } from "../../lib/audio-level.utils";

import { AudioTrackActions } from "./components/AudioTrackActions";
import { AudioTrackEffectsDialog } from "./components/AudioTrackEffectsDialog";
import { AudioTrackToggle } from "./components/AudioTrackToggle";
import { AudioTrackWaveform } from "./components/AudioTrackWaveform";

interface AudioTrackRowProps {
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
  stream: AudioStream;
  track: AudioTrackState;
  trackColor: string;
  trackNumber: number;
}

const AudioTrackRow = memo(function AudioTrackRow({
  clearLiveAudioTrackGain,
  setLiveAudioTrackGain,
  stream,
  track,
  trackColor,
  trackNumber,
}: AudioTrackRowProps) {
  const { t } = useTranslation();
  const [liveGainDraftDb, setLiveGainDb] = useState<number | null>(null);
  const liveGainDb = liveGainDraftDb ?? track.processing.gainDb;
  const controller = useAudioTrackController(stream.streamIndex);
  const streamTitle =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  return (
    <AudioTrackEffectsDialog
      onAnalyzeLoudness={controller.analyzeLoudness}
      onApply={controller.applyProcessing}
      title={streamTitle}
      track={track}
    >
      {(openEffects) => (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
              data-slot="audio-track-row"
              style={{ "--audio-track-color": trackColor } as CSSProperties}
            >
              <AudioTrackRowDetails
                clearLiveAudioTrackGain={clearLiveAudioTrackGain}
                controller={controller}
                liveGainDb={liveGainDb}
                onLiveGainChange={setLiveGainDb}
                onOpenEffects={openEffects}
                setLiveAudioTrackGain={setLiveAudioTrackGain}
                stream={stream}
                track={track}
                trackNumber={trackNumber}
              />
              <AudioTrackRowWaveform
                liveGainDb={liveGainDb}
                stream={stream}
                track={track}
                trackColor={trackColor}
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <AudioTrackActions
              controller={controller}
              mode="context"
              onOpenEffects={openEffects}
              stream={stream}
              trackNumber={trackNumber}
            />
          </ContextMenuContent>
        </ContextMenu>
      )}
    </AudioTrackEffectsDialog>
  );
});

function AudioTrackRowDetails({
  clearLiveAudioTrackGain,
  controller,
  liveGainDb,
  onLiveGainChange,
  onOpenEffects,
  setLiveAudioTrackGain,
  stream,
  track,
  trackNumber,
}: Omit<AudioTrackRowProps, "trackColor"> & {
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  controller: AudioTrackController;
  liveGainDb: number;
  onLiveGainChange: (gainDb: number | null) => void;
  onOpenEffects: () => void;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
}) {
  const { t } = useTranslation();

  const title =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  return (
    <div className="flex items-center gap-1">
      <AudioTrackToggle stream={stream} track={track} />

      <div className="grid min-w-0 flex-1 gap-0.5">
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
        <AudioTrackGainControl
          clearLiveAudioTrackGain={clearLiveAudioTrackGain}
          liveGainDb={liveGainDb}
          onCommit={controller.commitGain}
          onLiveGainChange={onLiveGainChange}
          setLiveAudioTrackGain={setLiveAudioTrackGain}
          streamIndex={stream.streamIndex}
          trackGainDb={track.processing.gainDb}
          trackNumber={trackNumber}
        />
      </div>

      <AudioTrackActions
        controller={controller}
        onOpenEffects={onOpenEffects}
        stream={stream}
        trackNumber={trackNumber}
      />
    </div>
  );
}

function AudioTrackGainControl({
  clearLiveAudioTrackGain,
  liveGainDb,
  onCommit,
  onLiveGainChange,
  setLiveAudioTrackGain,
  streamIndex,
  trackGainDb,
  trackNumber,
}: {
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  liveGainDb: number;
  onCommit: (gainDb: number) => void;
  onLiveGainChange: (gainDb: number | null) => void;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
  streamIndex: number;
  trackGainDb: number;
  trackNumber: number;
}) {
  const { i18n, t } = useTranslation();
  const liveGainRef = useRef(trackGainDb);
  const initialGainRef = useRef(trackGainDb);
  const interactionKindRef = useRef<"keyboard" | "pointer" | null>(null);
  const commitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (interactionKindRef.current === null) {
      liveGainRef.current = liveGainDb;
      initialGainRef.current = liveGainDb;
    }
  }, [liveGainDb]);

  const finishInteraction = useCallback(
    (gainDb = liveGainRef.current) => {
      if (interactionKindRef.current === null) return;
      interactionKindRef.current = null;
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      if (gainDb !== initialGainRef.current) onCommit(gainDb);
      clearLiveAudioTrackGain(streamIndex, gainDb);
      onLiveGainChange(null);
      initialGainRef.current = gainDb;
    },
    [clearLiveAudioTrackGain, onCommit, onLiveGainChange, streamIndex],
  );

  useEffect(
    () => () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      if (interactionKindRef.current !== null) {
        clearLiveAudioTrackGain(streamIndex, liveGainRef.current);
      }
    },
    [clearLiveAudioTrackGain, streamIndex],
  );

  const startInteraction = (kind: "keyboard" | "pointer") => {
    if (interactionKindRef.current === null) initialGainRef.current = liveGainRef.current;
    interactionKindRef.current = kind;
  };

  const updateGain = (values: number[]) => {
    const nextGain = values[0];
    if (nextGain === undefined) return;
    if (interactionKindRef.current === null) startInteraction("pointer");
    liveGainRef.current = nextGain;
    onLiveGainChange(nextGain);
    setLiveAudioTrackGain(streamIndex, nextGain);

    if (interactionKindRef.current === "keyboard") {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = window.setTimeout(() => finishInteraction(), 300);
    }
  };

  return (
    <div className="flex h-4 min-w-0 items-center gap-1.5">
      <Slider
        aria-label={t("audio.accessibility.trackGain", { number: trackNumber })}
        className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
        max={12}
        min={-24}
        onBlur={() => finishInteraction()}
        onKeyDownCapture={(event) => {
          if (event.key === "Enter") finishInteraction();
          else if (
            [
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "End",
              "Home",
              "PageDown",
              "PageUp",
            ].includes(event.key)
          )
            startInteraction("keyboard");
        }}
        onKeyUpCapture={(event) => {
          if (interactionKindRef.current === "keyboard" && event.key.startsWith("Arrow"))
            finishInteraction();
        }}
        onPointerCancelCapture={() => finishInteraction()}
        onPointerDownCapture={() => startInteraction("pointer")}
        onValueChange={updateGain}
        onValueCommit={(values) => {
          if (interactionKindRef.current === "pointer") finishInteraction(values[0]);
        }}
        step={0.5}
        value={[liveGainDb]}
      />
      <output className="w-10 shrink-0 text-right text-[10px] leading-none text-muted-foreground">
        {formatGain(liveGainDb, i18n.language)}
      </output>
    </div>
  );
}

function formatGain(gainDb: number, language: string): string {
  const value = new Intl.NumberFormat(language, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(gainDb);

  return `${value.replace(/-/g, "−")} dB`;
}

function AudioTrackRowWaveform({
  liveGainDb,
  stream,
  track,
  trackColor,
}: {
  liveGainDb: number;
  stream: AudioStream;
  track: AudioTrackState;
  trackColor: string;
}) {
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
      <AudioTrackWaveform gainDb={liveGainDb} stream={stream} track={track} />
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
      <AudioTrackEffectsIndicator processing={track.processing} />
    </div>
  );
}

function AudioTrackEffectsIndicator({ processing }: { processing: AudioTrackProcessing }) {
  const { i18n, t } = useTranslation();
  const summaries: string[] = [];
  const normalization = processing.loudnessNormalization;

  if (typeof normalization === "string") {
    const targetLufs = { webVideo: -14, streaming: -16, broadcast: -23 }[normalization];
    summaries.push(
      t("audio.messages.normalizeSummary", {
        target: formatProcessingValue(targetLufs, i18n.language),
      }),
    );
  } else if (normalization) {
    summaries.push(
      t("audio.messages.normalizeSummary", {
        target: formatProcessingValue(normalization.targetLufs, i18n.language),
      }),
    );
  }

  if (summaries.length === 0) return null;
  const summary = summaries.join(" · ");

  return (
    <div
      aria-label={t("audio.accessibility.appliedEffects", { summary })}
      className="pointer-events-none absolute top-1.5 left-1.5 z-3 inline-flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] leading-tight text-foreground/80 shadow-sm backdrop-blur-xs"
      data-slot="audio-track-effects-indicator"
      role="note"
    >
      <WandSparkles aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{summary}</span>
    </div>
  );
}

function formatProcessingValue(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 })
    .format(value)
    .replace(/-/g, "−");
}

export { AudioTrackRow };
