import { WandSparkles } from "lucide-react";
import { type CSSProperties, memo, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import {
  audioTrackLoudnessInputsKey,
  audioTrackNormalizationGainDb,
  type AudioTrackProcessing,
  getAudioTrackSignalEffect,
  loudnessNormalizationTargets,
} from "@/domain/audio-processing";
import { timelinePercent } from "@/domain/trim";
import { cn } from "@/lib/class-names.utils";

import {
  type AudioTrackController,
  useAudioTrackController,
} from "../../hooks/useAudioTrackController";
import {
  formatGain,
  noiseReductionPresetLabel,
  normalizationPresetLabel,
} from "../../lib/audio-level.utils";

import { AudioTrackContextMenuContent } from "./components/AudioTrackActions";
import { AudioTrackDetails } from "./components/AudioTrackDetails";
import { AudioTrackEffectsDialog } from "./components/AudioTrackEffectsDialog";
import { AudioTrackWaveform } from "./components/AudioTrackWaveform";

interface AudioTrackRowProps {
  streamIndex: number;
}

const AudioTrackRow = memo(function AudioTrackRow({ streamIndex }: AudioTrackRowProps) {
  const controller = useAudioTrackController(streamIndex);
  const { track, trackColor } = controller;

  if (!track || !controller.stream) return null;

  return (
    <AudioTrackEffectsDialog controller={controller}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
            data-slot="audio-track-row"
            style={{ "--audio-track-color": trackColor } as CSSProperties}
          >
            <AudioTrackDetails controller={controller} />
            <AudioTrackRowWaveform controller={controller} />
          </div>
        </ContextMenuTrigger>
        <AudioTrackContextMenuContent controller={controller} />
      </ContextMenu>
    </AudioTrackEffectsDialog>
  );
});

function AudioTrackRowWaveform({
  controller,
}: {
  controller: ReturnType<typeof useAudioTrackController>;
}) {
  const trim = useAppSelector(selectTrim);
  const source = useAppSelector(selectSourceSelection);
  const { liveGainDb, stream, track, trackColor } = controller;
  if (!stream || !track) return null;

  const activityRanges =
    track.activityAnalysis.status === "ready" && track.activityVisible
      ? track.activityAnalysis.value
      : [];

  return (
    <div
      className="relative h-12.5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
      data-enabled={track.enabled}
    >
      <AudioTrackWaveform
        gainDb={waveformGainDb(controller, trim, liveGainDb, source?.sourcePath)}
        stream={stream}
        track={track}
      />
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
      <AudioTrackGainIndicator controller={controller} />
    </div>
  );
}

function waveformGainDb(
  controller: AudioTrackController,
  trim: ReturnType<typeof selectTrim>,
  liveGainDb: number,
  sourcePath: string | undefined,
): number {
  const track = controller.track;
  if (!track || !sourcePath) return liveGainDb;
  const normalization = track.processing.loudnessNormalization;
  const analysis = track.loudnessAnalysis;
  if (!normalization) return liveGainDb;
  if (!trim || analysis?.status !== "ready") return 0;
  const cacheKey = audioTrackLoudnessInputsKey(
    sourcePath,
    track.streamIndex,
    trim,
    track.processing,
  );

  return analysis.cacheKey === cacheKey
    ? audioTrackNormalizationGainDb(normalization, analysis.value)
    : 0;
}

function AudioTrackGainIndicator({ controller }: { controller: AudioTrackController }) {
  const { i18n, t } = useTranslation();
  const normalization = controller.track?.processing.loudnessNormalization;
  const normalizedSummary = normalization
    ? formatNormalizationLevel(normalization, i18n.language, t)
    : null;

  return (
    <AudioTrackIndicator
      aria-label={
        normalizedSummary ?? t("audio.accessibility.trackGain", { number: controller.trackNumber })
      }
      className="absolute bottom-1 left-1 z-3"
      data-slot="audio-track-gain-indicator"
    >
      {normalizedSummary ?? formatGain(controller.liveGainDb, i18n.language)}
    </AudioTrackIndicator>
  );
}

function AudioTrackEffectsIndicator({ processing }: { processing: AudioTrackProcessing }) {
  const { i18n, t } = useTranslation();
  const summary = useMemo(() => {
    const summaries: string[] = [];
    const normalization = processing.loudnessNormalization;
    const noiseReduction = getAudioTrackSignalEffect(processing, "noiseReduction");

    if (noiseReduction) {
      summaries.push(
        t("audio.messages.noiseReductionEffectSummary", {
          preset: noiseReductionPresetLabel(noiseReduction.preset, t),
        }),
      );
    }

    if (typeof normalization === "string") {
      summaries.push(
        t("audio.messages.normalizedEffectSummary", {
          preset: normalizationPresetLabel(normalization, t),
        }),
      );
    } else if (normalization) {
      summaries.push(
        t("audio.messages.normalizedEffectSummary", {
          preset: t("audio.options.normalizationCustom"),
        }),
      );
    }

    const highPassCutoffHz = getAudioTrackSignalEffect(processing, "highPass")?.cutoffHz;
    if (highPassCutoffHz !== undefined) {
      summaries.push(t("audio.messages.highPassEffectSummary", { cutoff: highPassCutoffHz }));
    }

    const limiter = getAudioTrackSignalEffect(processing, "limiter");
    if (limiter) {
      summaries.push(
        t("audio.messages.limitedEffectSummary", {
          ceiling: formatProcessingValue(limiter.ceilingDb, i18n.language),
        }),
      );
    }

    return summaries.length === 0 ? null : summaries.join(" · ");
  }, [i18n.language, processing, t]);

  if (!summary) return null;

  return (
    <AudioTrackIndicator
      aria-label={t("audio.accessibility.appliedEffects", { summary })}
      className="absolute top-1 left-1 z-3"
      data-slot="audio-track-effects-indicator"
    >
      <WandSparkles aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{summary}</span>
    </AudioTrackIndicator>
  );
}

function AudioTrackIndicator({
  "aria-label": ariaLabel,
  children,
  className,
  ...props
}: {
  "aria-label": string;
  children: ReactNode;
  className: string;
  "data-slot": string;
}) {
  return (
    <Badge
      aria-label={ariaLabel}
      className={cn(
        "max-w-[calc(100%-0.5rem)] gap-1.5 bg-background/25 backdrop-blur-xs",
        className,
      )}
      data-slot={props["data-slot"]}
      size="xs"
      variant="outline"
    >
      {children}
    </Badge>
  );
}

function formatProcessingValue(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 })
    .format(value)
    .replace(/-/g, "−");
}

function formatNormalizationLevel(
  normalization: NonNullable<AudioTrackProcessing["loudnessNormalization"]>,
  language: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const { maxTruePeakDb, targetLufs } = loudnessNormalizationTargets(normalization);
  return t("audio.messages.normalizedLevelSummary", {
    peak: formatProcessingValue(maxTruePeakDb, language),
    target: formatProcessingValue(targetLufs, language),
  });
}

export { AudioTrackRow };
