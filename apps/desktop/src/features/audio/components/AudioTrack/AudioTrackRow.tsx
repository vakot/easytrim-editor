import { WandSparkles } from "lucide-react";
import { type CSSProperties, memo } from "react";
import { useTranslation } from "react-i18next";

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AudioTrackProcessing } from "@/domain/audio-processing";
import { timelinePercent } from "@/domain/trim";

import { useAudioTrackController } from "../../hooks/useAudioTrackController";

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
