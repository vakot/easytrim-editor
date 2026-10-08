import { MoreVertical } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataLanguage, setMetadataLanguage] = useState("");
  const { stream, track, trackNumber } = controller;
  if (!stream || !track) return null;

  const title =
    track.title ||
    stream.title ||
    track.language ||
    stream.language ||
    t("audio.tracks.defaultName", { number: trackNumber });

  const openMetadataDialog = () => {
    setMetadataTitle(track.title ?? stream.title ?? "");
    setMetadataLanguage(track.language ?? stream.language ?? "");
    setMetadataDialogOpen(true);
  };

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
              {track.isDefault ? ` · ${t("audio.tracks.default")}` : ""}
            </p>
          </div>
        </AudioTrackDetailsSection>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("audio.tracks.actionsLabel", { number: trackNumber })}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <AudioTrackDropdownMenuContent
          controller={controller}
          onOpenMetadata={openMetadataDialog}
        />
      </DropdownMenu>
      <Dialog onOpenChange={setMetadataDialogOpen} open={metadataDialogOpen}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              controller.updateMetadata(metadataTitle, metadataLanguage);
              setMetadataDialogOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("audio.tracks.metadataTitle")}</DialogTitle>
              <DialogDescription>{t("audio.tracks.metadataDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`audio-track-title-${track.streamIndex}`}>
                {t("audio.tracks.titleLabel")}
              </Label>
              <Input
                autoComplete="off"
                id={`audio-track-title-${track.streamIndex}`}
                maxLength={256}
                onChange={(event) => setMetadataTitle(event.currentTarget.value)}
                value={metadataTitle}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`audio-track-language-${track.streamIndex}`}>
                {t("audio.tracks.languageLabel")}
              </Label>
              <Input
                autoComplete="off"
                id={`audio-track-language-${track.streamIndex}`}
                maxLength={16}
                onChange={(event) => setMetadataLanguage(event.currentTarget.value)}
                pattern="[A-Za-z0-9-]*"
                placeholder={t("audio.tracks.languagePlaceholder")}
                title={t("audio.tracks.languageHelp")}
                value={metadataLanguage}
              />
            </div>
            <DialogFooter>
              <Button type="submit">{t("common.actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
      <TooltipContent>{t("audio.normalization.manualGainUnavailable")}</TooltipContent>
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
        aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
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
