import { MoreVertical } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";
import { formatChannels, formatGain, MIN_SLIDER_DECIBELS } from "../../../lib/audio-level.utils";

import { AudioTrackDropdownMenuContent } from "./AudioTrackActions";
import { AudioTrackToggle } from "./AudioTrackToggle";

function AudioTrackDetails({ controller }: { controller: AudioTrackController }) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { stream, track, trackNumber } = controller;
  if (!stream || !track) return null;

  const title =
    stream.title ??
    stream.language ??
    t("audio.tracks.labels.defaultTrack", { number: trackNumber });

  return (
    <div
      className="flex items-center gap-1"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
      onFocusCapture={() => setIsFocused(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AudioTrackToggle controller={controller} />

      <div className="relative min-w-0 flex-1">
        <AudioTrackDetailsSection controller={controller} hovered={isFocused || isHovered}>
          <div>
            <p
              className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
              data-enabled={track.enabled}
            >
              {title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              #{trackNumber} · {stream.codecName.toUpperCase()} · {formatChannels(stream, t)}
            </p>
          </div>
        </AudioTrackDetailsSection>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("audio.tracks.accessibility.trackActions", { number: trackNumber })}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <AudioTrackDropdownMenuContent controller={controller} />
      </DropdownMenu>
    </div>
  );
}

function AudioTrackDetailsSection({
  children,
  controller,
  hovered,
}: {
  children: React.ReactNode;
  controller: AudioTrackController;
  hovered?: boolean;
}) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const { stream, track } = controller;
  if (!stream || !track) return null;

  const normalization = track.processing.loudnessNormalization;

  if (normalization === undefined) {
    return (
      <>
        {children}
        <AnimatePresence initial={false}>
          {hovered ? (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-1 flex items-center bg-card"
              exit={{ opacity: 0, scale: 0.96 }}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
              key="gain-control"
              transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
            >
              <div className="w-full">
                <AudioTrackGainControl controller={controller} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{t("audio.normalization.tooltips.normalizationReplacesGain")}</TooltipContent>
    </Tooltip>
  );
}

function AudioTrackGainControl({ controller }: { controller: AudioTrackController }) {
  const { i18n, t } = useTranslation();
  const pointerDownPosition = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedSinceDown = useRef(false);
  const {
    cancelGainInteraction,
    commitPointerGain,
    finishGainInteraction,
    gainSliderDb,
    handleGainKeyDown,
    handleGainKeyUp,
    startPointerGainInteraction,
    trackNumber,
    updateLiveGain,
  } = controller;

  return (
    <div className="flex h-4 min-w-0 items-center gap-1.5">
      <Slider
        aria-label={t("audio.tracks.accessibility.trackGain", { number: trackNumber })}
        className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
        markers={[
          { label: "−∞", value: MIN_SLIDER_DECIBELS },
          { label: "0 dB", value: 0 },
        ]}
        max={12}
        min={MIN_SLIDER_DECIBELS}
        onBlur={() => finishGainInteraction()}
        onDoubleClick={() => {
          if (pointerMovedSinceDown.current) return;
          updateLiveGain([0]);
          finishGainInteraction(0);
        }}
        onKeyDownCapture={(event) => handleGainKeyDown(event.key)}
        onKeyUpCapture={(event) => handleGainKeyUp(event.key)}
        onPointerCancelCapture={cancelGainInteraction}
        onPointerDownCapture={(event) => {
          pointerDownPosition.current = { x: event.clientX, y: event.clientY };
          pointerMovedSinceDown.current = false;
          startPointerGainInteraction();
        }}
        onPointerMoveCapture={(event) => {
          const startPosition = pointerDownPosition.current;
          if (!startPosition) return;

          const distance = Math.hypot(
            event.clientX - startPosition.x,
            event.clientY - startPosition.y,
          );

          if (distance > 5) pointerMovedSinceDown.current = true;
        }}
        onValueChange={updateLiveGain}
        onValueCommit={commitPointerGain}
        step={0.5}
        value={[gainSliderDb]}
      />
      <output className="w-10 shrink-0 text-right text-[10px] leading-none text-muted-foreground">
        {formatGain(gainSliderDb, i18n.language)}
      </output>
    </div>
  );
}

export { AudioTrackDetails };
