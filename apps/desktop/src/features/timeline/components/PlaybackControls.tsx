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

import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { cn } from "@/lib/class-names.utils";

import { FRAME_SHUTTLE_HOLD_DELAY_MS } from "../lib/editor-shortcuts";

function PlaybackControls() {
  const { t } = useTranslation();
  const playback = usePlayback();
  const timeline = useTimeline();
  const disabled = !playback.canInteract;

  return (
    <div
      aria-label={t("preview.accessibility.controls")}
      className="relative flex items-center justify-center"
    >
      <div className="flex items-center gap-1.5">
        <TransportButton
          disabled={disabled || !timeline.canSetSegmentStart}
          label={t("preview.actions.setStart")}
          onClick={() => {
            playback.setSegmentBoundary("start", { type: "button", id: "set-start" });
          }}
          shortcut="I"
          title={
            timeline.canSetSegmentStart
              ? t("preview.tooltips.setStart")
              : t("preview.messages.setStartUnavailable")
          }
        >
          <SquareArrowRight />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          hold={{
            active: playback.shuttleDirection === -1,
            onEnd: () => playback.stopShuttle({ type: "button", id: "previous-frame" }),
            onStart: () => playback.startShuttle(-1, { type: "button", id: "previous-frame" }),
          }}
          label={t("preview.actions.previousFrame")}
          onClick={() => {
            playback.stepFrame(-1, { type: "button", id: "previous-frame" });
          }}
          shortcut="ArrowLeft"
          title={t("preview.tooltips.previousFrame")}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          label={playback.isPlaying ? t("preview.actions.pause") : t("preview.actions.play")}
          onClick={() => {
            playback.toggle({ type: "button", id: "playback" });
          }}
          primary
          shortcut="Space"
          title={playback.isPlaying ? t("preview.tooltips.pause") : t("preview.tooltips.play")}
        >
          {playback.isPlaying ? <Pause /> : <Play />}
        </TransportButton>
        <TransportButton
          disabled={disabled}
          hold={{
            active: playback.shuttleDirection === 1,
            onEnd: () => playback.stopShuttle({ type: "button", id: "next-frame" }),
            onStart: () => playback.startShuttle(1, { type: "button", id: "next-frame" }),
          }}
          label={t("preview.actions.nextFrame")}
          onClick={() => {
            playback.stepFrame(1, { type: "button", id: "next-frame" });
          }}
          shortcut="ArrowRight"
          title={t("preview.tooltips.nextFrame")}
        >
          <SkipForward />
        </TransportButton>
        <TransportButton
          disabled={disabled || !timeline.canSetSegmentEnd}
          label={t("preview.actions.setEnd")}
          onClick={() => {
            playback.setSegmentBoundary("end", { type: "button", id: "set-end" });
          }}
          shortcut="O"
          title={
            timeline.canSetSegmentEnd
              ? t("preview.tooltips.setEnd")
              : t("preview.messages.setEndUnavailable")
          }
        >
          <SquareArrowLeft />
        </TransportButton>
      </div>
      {playback.transportError ? (
        <Alert className="absolute top-full z-10 mt-2 w-72" variant="destructive">
          <AlertDescription>{playback.transportError}</AlertDescription>
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
          data-editor-keyboard="timeline-transport"
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

export { PlaybackControls };
