import {
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SquareArrowLeft,
  SquareArrowRight,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type MouseEvent, type PointerEvent, type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import {
  useTimelineEditing,
  useTimelineReadiness,
  useTimelineTransport,
} from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";

import { FRAME_SHUTTLE_HOLD_DELAY_MS } from "../lib/editor-shortcuts";

const MotionButton = motion.create(Button);
const MARKER_NAVIGATION_COLLAPSED_MARGIN = "-0.375rem";

function preventMarkerNavigationMouseFocus(event: MouseEvent<HTMLButtonElement>) {
  if (event.button === 0) event.preventDefault();
}

function PlaybackControls({ className }: { className?: string }) {
  const { t } = useTranslation();
  const editing = useTimelineEditing();
  const readiness = useTimelineReadiness();
  const playback = useTimelineTransport();
  const shouldReduceMotion = useReducedMotion() === true;
  const { executeCommand } = useApplicationCommands();
  const previousMarkerCommand = useApplicationCommand("previous-marker");
  const nextMarkerCommand = useApplicationCommand("next-marker");
  const disabled = !readiness.canInteract;
  const previousMarkerDisabled =
    disabled || !previousMarkerCommand.enabled || previousMarkerCommand.pending;

  const nextMarkerDisabled = disabled || !nextMarkerCommand.enabled || nextMarkerCommand.pending;
  const showMarkerNavigation = previousMarkerCommand.enabled || nextMarkerCommand.enabled;

  return (
    <div
      aria-label={t("preview.accessibility.controls")}
      className={cn("relative flex items-center justify-center", className)}
    >
      <div className="flex items-center gap-1.5">
        <TransportButton
          disabled={disabled || !editing.canSetSegmentStart}
          label={t("preview.segment.setStart")}
          onClick={() => {
            editing.onSetSegmentBoundary("start", { type: "button", id: "set-start" });
          }}
          shortcut={{ code: "KeyI", key: "I", modifier: "none" }}
          title={t("preview.segment.setStart")}
        >
          <SquareArrowRight />
        </TransportButton>
        <AnimatePresence initial={false}>
          {showMarkerNavigation ? (
            <Tooltip key="previous-marker-navigation">
              <TooltipTrigger asChild>
                <MotionButton
                  animate={{
                    opacity: previousMarkerDisabled ? 0.5 : 1,
                    width: "1.75rem",
                    marginInlineStart: 0,
                  }}
                  aria-label={previousMarkerCommand.label}
                  className="overflow-hidden transition-colors"
                  data-editor-keyboard="timeline-transport"
                  disabled={previousMarkerDisabled}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginInlineStart: MARKER_NAVIGATION_COLLAPSED_MARGIN,
                  }}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          width: 0,
                          marginInlineStart: MARKER_NAVIGATION_COLLAPSED_MARGIN,
                        }
                  }
                  onClick={() => void executeCommand("previous-marker", "button")}
                  onMouseDown={preventMarkerNavigationMouseFocus}
                  size="icon-sm"
                  transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" }}
                  type="button"
                  variant="ghost"
                >
                  <ChevronsLeft />
                </MotionButton>
              </TooltipTrigger>
              <TooltipContent>{previousMarkerCommand.label}</TooltipContent>
            </Tooltip>
          ) : null}
        </AnimatePresence>
        <TransportButton
          disabled={disabled}
          hold={{
            active: playback.shuttleDirection === -1,
            onEnd: () => playback.stopShuttle({ type: "button", id: "previous-frame" }),
            onStart: () => playback.startShuttle(-1, { type: "button", id: "previous-frame" }),
          }}
          label={t("preview.frame.previous")}
          onClick={() => {
            playback.stepFrame(-1, { type: "button", id: "previous-frame" });
          }}
          shortcut={{ code: "ArrowLeft", key: "ArrowLeft", modifier: "none" }}
          title={t("preview.frame.previousFrameTooltip")}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          label={playback.isPlaying ? t("preview.playback.pause") : t("preview.playback.play")}
          onClick={() => {
            playback.toggle({ type: "button", id: "playback" });
          }}
          primary
          shortcut={{ code: "Space", key: "Space", modifier: "none" }}
          title={
            playback.isPlaying
              ? t("preview.playback.pauseTooltip")
              : t("preview.playback.playTooltip")
          }
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
          label={t("preview.frame.next")}
          onClick={() => {
            playback.stepFrame(1, { type: "button", id: "next-frame" });
          }}
          shortcut={{ code: "ArrowRight", key: "ArrowRight", modifier: "none" }}
          title={t("preview.frame.nextFrameTooltip")}
        >
          <SkipForward />
        </TransportButton>
        <AnimatePresence initial={false}>
          {showMarkerNavigation ? (
            <Tooltip key="next-marker-navigation">
              <TooltipTrigger asChild>
                <MotionButton
                  animate={{
                    opacity: nextMarkerDisabled ? 0.5 : 1,
                    width: "1.75rem",
                    marginInlineStart: 0,
                  }}
                  aria-label={nextMarkerCommand.label}
                  className="overflow-hidden transition-colors"
                  data-editor-keyboard="timeline-transport"
                  disabled={nextMarkerDisabled}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginInlineStart: MARKER_NAVIGATION_COLLAPSED_MARGIN,
                  }}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          width: 0,
                          marginInlineStart: MARKER_NAVIGATION_COLLAPSED_MARGIN,
                        }
                  }
                  onClick={() => void executeCommand("next-marker", "button")}
                  onMouseDown={preventMarkerNavigationMouseFocus}
                  size="icon-sm"
                  transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" }}
                  type="button"
                  variant="ghost"
                >
                  <ChevronsRight />
                </MotionButton>
              </TooltipTrigger>
              <TooltipContent>{nextMarkerCommand.label}</TooltipContent>
            </Tooltip>
          ) : null}
        </AnimatePresence>
        <TransportButton
          disabled={disabled || !editing.canSetSegmentEnd}
          label={t("preview.segment.setEnd")}
          onClick={() => {
            editing.onSetSegmentBoundary("end", { type: "button", id: "set-end" });
          }}
          shortcut={{ code: "KeyO", key: "O", modifier: "none" }}
          title={t("preview.segment.setEnd")}
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
  shortcut: ApplicationShortcut;
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
          aria-keyshortcuts={getShortcutAriaValue(shortcut)}
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
      <ShortcutTooltipContent shortcut={shortcut} title={title} />
    </Tooltip>
  );
}

export { PlaybackControls };
