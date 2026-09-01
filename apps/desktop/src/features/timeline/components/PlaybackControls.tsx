import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SquareArrowLeft,
  SquareArrowRight,
} from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { TrimBoundary } from "@/domain/trim";
import { cn } from "@/lib/class-names.utils";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import { FRAME_SHUTTLE_HOLD_DELAY_MS, type FrameShuttleDirection } from "../lib/editor-shortcuts";

interface PlaybackControlsProps {
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  disabled?: boolean;
  error: string | null;
  isPlaying: boolean;
  onSetSegmentBoundary: (boundary: TrimBoundary, origin?: DiagnosticOrigin) => void;
  onShuttleEnd: (origin?: DiagnosticOrigin) => void;
  onShuttleStart: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
  onStepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
  onTogglePlayback: (origin?: DiagnosticOrigin) => void;
  shuttleDirection: FrameShuttleDirection | 0;
}

export function PlaybackControls({
  canSetSegmentEnd,
  canSetSegmentStart,
  disabled = false,
  error,
  isPlaying,
  onSetSegmentBoundary,
  onShuttleEnd,
  onShuttleStart,
  onStepFrame,
  onTogglePlayback,
  shuttleDirection,
}: PlaybackControlsProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("preview.accessibility.controls")}
      className="relative flex items-center justify-center"
    >
      <div className="flex items-center gap-1.5">
        <TransportButton
          disabled={disabled || !canSetSegmentStart}
          label={t("preview.actions.setStart")}
          onClick={() => {
            onSetSegmentBoundary("start", { type: "button", id: "set-start" });
          }}
          shortcut="I"
          title={
            canSetSegmentStart
              ? t("preview.tooltips.setStart")
              : t("preview.messages.setStartUnavailable")
          }
        >
          <SquareArrowRight />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          hold={{
            active: shuttleDirection === -1,
            onEnd: () => onShuttleEnd({ type: "button", id: "previous-frame" }),
            onStart: () => onShuttleStart(-1, { type: "button", id: "previous-frame" }),
          }}
          label={t("preview.actions.previousFrame")}
          onClick={() => {
            onStepFrame(-1, { type: "button", id: "previous-frame" });
          }}
          shortcut="ArrowLeft"
          title={t("preview.tooltips.previousFrame")}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          label={isPlaying ? t("preview.actions.pause") : t("preview.actions.play")}
          onClick={() => {
            onTogglePlayback({ type: "button", id: "playback" });
          }}
          primary
          shortcut="Space"
          title={isPlaying ? t("preview.tooltips.pause") : t("preview.tooltips.play")}
        >
          {isPlaying ? <Pause /> : <Play />}
        </TransportButton>
        <TransportButton
          disabled={disabled}
          hold={{
            active: shuttleDirection === 1,
            onEnd: () => onShuttleEnd({ type: "button", id: "next-frame" }),
            onStart: () => onShuttleStart(1, { type: "button", id: "next-frame" }),
          }}
          label={t("preview.actions.nextFrame")}
          onClick={() => {
            onStepFrame(1, { type: "button", id: "next-frame" });
          }}
          shortcut="ArrowRight"
          title={t("preview.tooltips.nextFrame")}
        >
          <SkipForward />
        </TransportButton>
        <TransportButton
          disabled={disabled || !canSetSegmentEnd}
          label={t("preview.actions.setEnd")}
          onClick={() => {
            onSetSegmentBoundary("end", { type: "button", id: "set-end" });
          }}
          shortcut="O"
          title={
            canSetSegmentEnd
              ? t("preview.tooltips.setEnd")
              : t("preview.messages.setEndUnavailable")
          }
        >
          <SquareArrowLeft />
        </TransportButton>
      </div>
      {error ? (
        <Alert className="absolute top-full z-10 mt-2 w-72" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function TransportButton({
  children,
  disabled,
  hold,
  label,
  onClick,
  primary = false,
  shortcut,
  title,
}: {
  children: ReactNode;
  disabled?: boolean;
  hold?: {
    active: boolean;
    onEnd: () => void;
    onStart: () => void;
  };
  label: string;
  onClick: () => void;
  primary?: boolean;
  shortcut: string;
  title: string;
}) {
  const holdRef = useRef(hold);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartedRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const suppressClickClearTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
      if (suppressClickClearTimerRef.current !== null)
        window.clearTimeout(suppressClickClearTimerRef.current);
      if (holdStartedRef.current) holdRef.current?.onEnd();
    },
    [],
  );

  function finishPointerPress(event: PointerEvent<HTMLButtonElement>, clickWillFollow: boolean) {
    if (!pointerActiveRef.current || event.pointerId !== pointerIdRef.current) return;
    pointerActiveRef.current = false;
    pointerIdRef.current = null;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdStartedRef.current) {
      holdStartedRef.current = false;
      holdRef.current?.onEnd();
    }
    if (!clickWillFollow) {
      suppressClickRef.current = false;
      return;
    }
    suppressClickClearTimerRef.current = window.setTimeout(() => {
      suppressClickClearTimerRef.current = null;
      suppressClickRef.current = false;
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-keyshortcuts={shortcut}
          aria-label={label}
          aria-pressed={hold ? hold.active : undefined}
          className={cn(
            primary && "rounded-full",
            hold && "touch-none",
            hold?.active && "bg-accent text-accent-foreground",
          )}
          data-editor-shortcut="true"
          disabled={disabled}
          onClick={() => {
            if (suppressClickRef.current) {
              if (suppressClickClearTimerRef.current !== null) {
                window.clearTimeout(suppressClickClearTimerRef.current);
                suppressClickClearTimerRef.current = null;
              }
              suppressClickRef.current = false;
              return;
            }
            onClick();
          }}
          onLostPointerCapture={(event) => finishPointerPress(event, false)}
          onPointerCancel={(event) => finishPointerPress(event, false)}
          onPointerDown={(event) => {
            if (!hold || event.button !== 0 || event.isPrimary === false) return;
            pointerActiveRef.current = true;
            pointerIdRef.current = event.pointerId;
            suppressClickRef.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onClick();
            holdTimerRef.current = window.setTimeout(() => {
              if (!pointerActiveRef.current) return;
              holdStartedRef.current = true;
              holdRef.current?.onStart();
            }, FRAME_SHUTTLE_HOLD_DELAY_MS);
          }}
          onPointerUp={(event) => finishPointerPress(event, true)}
          size={primary ? "icon-lg" : "icon-sm"}
          type="button"
          variant={primary ? "default" : "ghost"}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
