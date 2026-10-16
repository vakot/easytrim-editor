import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { localizeAppError } from "@/i18n/app-errors";
import { cn } from "@/lib/class-names.utils";

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
          "flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-0.5 text-[11px] shadow-sm",
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
