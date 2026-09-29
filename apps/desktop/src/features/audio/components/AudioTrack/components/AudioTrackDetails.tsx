import { MoreVertical } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";
import { formatChannels } from "../../../lib/audio-level.utils";

import { AudioTrackDropdownMenuContent } from "./AudioTrackActions";
import { AudioTrackToggle } from "./AudioTrackToggle";

function AudioTrackDetails({ controller }: { controller: AudioTrackController }) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { stream, track, trackNumber } = controller;
  if (!stream || !track) return null;

  const title =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

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

      <div className="relative grid min-w-0 flex-1 gap-0.5">
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

        <AnimatePresence initial={false}>
          {isHovered || isFocused ? (
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
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("audio.accessibility.trackActions", { number: trackNumber })}
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

function AudioTrackGainControl({ controller }: { controller: AudioTrackController }) {
  const { i18n, t } = useTranslation();
  const {
    cancelGainInteraction,
    commitPointerGain,
    finishGainInteraction,
    handleGainKeyDown,
    handleGainKeyUp,
    liveGainDb,
    startPointerGainInteraction,
    trackNumber,
    updateLiveGain,
  } = controller;

  return (
    <div className="flex h-4 min-w-0 items-center gap-1.5">
      <Slider
        aria-label={t("audio.accessibility.trackGain", { number: trackNumber })}
        className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
        max={12}
        min={-24}
        onBlur={() => finishGainInteraction()}
        onKeyDownCapture={(event) => handleGainKeyDown(event.key)}
        onKeyUpCapture={(event) => handleGainKeyUp(event.key)}
        onPointerCancelCapture={cancelGainInteraction}
        onPointerDownCapture={startPointerGainInteraction}
        onValueChange={updateLiveGain}
        onValueCommit={commitPointerGain}
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

export { AudioTrackDetails };
