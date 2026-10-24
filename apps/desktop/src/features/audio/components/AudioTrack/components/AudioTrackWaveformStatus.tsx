import { LoaderCircle, TriangleAlert } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { localizeAppError } from "@/i18n/app-errors";

import { useWaveformPrepare } from "../../../hooks/useWaveformPreparation";

type AudioTrackWaveformState = AudioTrackState["waveform"];

interface AudioTrackWaveformStatusProps {
  /** Whether an earlier envelope is drawn underneath. It changes the wording, not the layout. */
  hasEnvelope: boolean;
  /** Whether a waveform is being prepared. */
  loading: boolean;
  reducedMotion: boolean;
  streamIndex: number;
  waveform: AudioTrackWaveformState;
}

/**
 * The one presentation of a waveform that is not ready, whether it is generated for the first time
 * or regenerated: a shimmer over the waveform area and a centered status. Only the waveform
 * underneath differs, so the feedback is the same with or without an earlier envelope.
 */
function AudioTrackWaveformStatus({
  hasEnvelope,
  loading,
  reducedMotion,
  streamIndex,
  waveform,
}: AudioTrackWaveformStatusProps) {
  if (loading) {
    return (
      <>
        {!hasEnvelope && <AudioTrackWaveformSkeleton seed={(streamIndex + 1) * 0x9e3779b1} />}
        <AudioTrackWaveformShimmer reducedMotion={reducedMotion} />
        <AudioTrackWaveformLoading />
      </>
    );
  }
  if (waveform.status === "failed") {
    return (
      <AudioTrackWaveformFailure
        hasEnvelope={hasEnvelope}
        streamIndex={streamIndex}
        waveform={waveform}
      />
    );
  }
  return null;
}

/**
 * Centered in the waveform, clear of the corner controls, and transparent to pointer input
 * except for the status itself when it holds an action.
 */
function AudioTrackWaveformOverlay({
  children,
  icon,
  interactive = false,
  role,
}: {
  children: ReactNode;
  icon: ReactNode;
  interactive?: boolean;
  role?: "status";
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-3 grid place-items-center px-12 text-xs text-muted-foreground"
      data-slot="audio-track-waveform-status"
      role={role}
    >
      <div
        className={cn(
          "flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-0.5 text-[0.6875rem] shadow-sm",
          interactive && "pointer-events-auto",
        )}
      >
        {icon}
        {children}
      </div>
    </div>
  );
}

function AudioTrackWaveformLoading() {
  const { t } = useTranslation();

  return (
    <AudioTrackWaveformOverlay
      icon={
        <LoaderCircle
          aria-hidden="true"
          className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
        />
      }
      role="status"
    >
      <span className="truncate">{t("audio.waveform.preparing")}</span>
    </AudioTrackWaveformOverlay>
  );
}

function AudioTrackWaveformFailure({
  hasEnvelope,
  streamIndex,
  waveform,
}: {
  hasEnvelope: boolean;
  streamIndex: number;
  waveform: Extract<AudioTrackWaveformState, { status: "failed" }>;
}) {
  const { t } = useTranslation();
  const prepare = useWaveformPrepare(streamIndex, waveform);

  return (
    <AudioTrackWaveformOverlay
      icon={<TriangleAlert aria-hidden="true" className="size-3 shrink-0" />}
      interactive
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="truncate" tabIndex={0}>
            {hasEnvelope ? t("audio.waveform.outdated") : t("audio.waveform.unavailable")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{localizeAppError(waveform.error, t)}</TooltipContent>
      </Tooltip>

      <Button onClick={prepare} size="xs" type="button" variant="ghost">
        {t("common.actions.retry")}
      </Button>
    </AudioTrackWaveformOverlay>
  );
}

const SKELETON_BAR_COUNT = 256;

/** A small seeded generator, so a placeholder is stable for its seed without any state. */
function mulberry32(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Uneven bar heights (percent): a slow swell with a seeded phase and pace, broken up by seeded
 * per-bar variation, so tracks differ a little while each one always looks the same.
 */
function skeletonBarHeights(seed: number): number[] {
  const random = mulberry32(seed);
  const phase = random() * Math.PI * 2;
  const pace = 0.12 + random() * 0.2;

  return Array.from({ length: SKELETON_BAR_COUNT }, (_, index) =>
    Math.round(14 + 70 * Math.abs(Math.sin(index * pace + phase)) * (0.35 + 0.65 * random())),
  );
}

/**
 * Stands in for the waveform until the first one exists. It is static, so reduced motion needs
 * no variant; the shimmer above it carries the activity.
 */
function AudioTrackWaveformSkeleton({ seed }: { seed: number }) {
  const heights = useMemo(() => skeletonBarHeights(seed), [seed]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-1 z-1 flex items-center gap-0.5 overflow-hidden"
      data-testid="waveform-skeleton"
    >
      {heights.map((height, index) => (
        // The bars never reorder, so the index is their identity.
        <span
          className="min-w-px flex-1 rounded-full bg-primary/10"
          key={index}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Marks the waveform area as being prepared. With reduced motion it is a static tint instead of a
 * moving highlight.
 */
function AudioTrackWaveformShimmer({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-2 overflow-hidden",
        reducedMotion && "bg-foreground/5",
      )}
      data-testid="waveform-shimmer"
    >
      {!reducedMotion && (
        <span className="absolute inset-y-0 left-0 w-1/3 animate-waveform-shimmer bg-linear-to-r from-transparent via-foreground/10 to-transparent" />
      )}
    </span>
  );
}

export { AudioTrackWaveformStatus };
