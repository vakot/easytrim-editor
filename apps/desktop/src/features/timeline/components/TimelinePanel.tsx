import { Gauge, Volume1, Volume2, VolumeOff } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  playbackSpeedChanged,
  selectPlaybackSpeed,
} from "@/app/store/slices/playback-controls-slice";
import {
  playbackVolumeChanged,
  playbackVolumeToggled,
  selectPlaybackVolumePercent,
} from "@/app/store/slices/preferences-slice";
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  type PlaybackSpeed,
} from "@/domain/playback-speed";
import { cn } from "@/lib/class-names.utils";

import { PlaybackControls } from "./PlaybackControls";
import { PlaybackTimecode } from "./PlaybackTimecode";
import styles from "./TimelinePanel.module.css";
import { TimelineScale } from "./TimelineScale";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineValues } from "./TimelineValues";

function TimelinePanel() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="timeline-title"
      className="min-w-0 p-3 select-none"
      data-testid="timeline-fixed-content"
    >
      <div className={styles.timelineHeader}>
        <div className="grid w-full grid-cols-(--editor-timeline-track-grid-columns) gap-2">
          <div className="min-w-0 justify-self-start">
            <h2
              className="mb-0.5 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
              id="timeline-title"
            >
              {t("timeline.labels.selectedSegment")}
            </h2>
            <PlaybackTimecode />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 gap-1">
              <PlaybackSpeedControl />
              <PlaybackVolumeControl />
            </div>

            <PlaybackControls className="flex-1" />
            <TimelineValues className="flex-1 justify-end" />
          </div>
        </div>
      </div>

      <TimelineScale />

      <div
        className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) items-center gap-3"
        data-slot="timeline-row"
      >
        <TimelineToolbar />
        <TimelineTrack />
      </div>
    </section>
  );
}

const PLAYBACK_SPEED_MARKERS = [0.5, 1, 1.5, 2, 3].map((speed) => ({
  value: PLAYBACK_SPEED_STEPS.indexOf(speed as PlaybackSpeed),
  label: `${speed}×`,
}));

const PLAYBACK_SPEED_PRESETS = [0.5, 1, 2, 3].map((speed) => ({
  value: speed as PlaybackSpeed,
  label: `${speed}×`,
}));

function PlaybackSpeedControl() {
  const { t } = useTranslation();
  const speed = useAppSelector(selectPlaybackSpeed);
  const dispatch = useAppDispatch();
  const stepIndex = PLAYBACK_SPEED_STEPS.indexOf(speed);
  const enabled = speed !== DEFAULT_PLAYBACK_SPEED;

  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label={t("preview.labels.playbackSpeed")}
              aria-pressed={enabled}
              className={cn(enabled && "text-primary aria-expanded:text-primary")}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <Gauge />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("preview.tooltips.playbackSpeed")}</TooltipContent>

        <PopoverContent align="start" className="grid w-56 gap-2 p-2.5" side="bottom">
          <div className="flex items-center gap-1">
            {PLAYBACK_SPEED_PRESETS.map(({ label, value }) => (
              <Button
                className="flex-1"
                key={`speed-${value}`}
                onClick={() => dispatch(playbackSpeedChanged(value))}
                size="xs"
                variant={speed === value ? "default" : "secondary"}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Slider
              aria-label={t("preview.labels.playbackSpeed")}
              className="mt-2 min-w-0 flex-1 **:data-[slot=slider-track]:h-1.5"
              markers={PLAYBACK_SPEED_MARKERS}
              max={PLAYBACK_SPEED_STEPS.length - 1}
              min={0}
              onDoubleClick={() => dispatch(playbackSpeedChanged(DEFAULT_PLAYBACK_SPEED))}
              onValueChange={([index]) => {
                const nextSpeed = PLAYBACK_SPEED_STEPS[index ?? stepIndex];
                if (nextSpeed !== undefined) dispatch(playbackSpeedChanged(nextSpeed));
              }}
              step={1}
              value={[stepIndex]}
            />
            <output className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {speed.toFixed(2)}×
            </output>
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
}

function PlaybackVolumeControl() {
  const dispatch = useAppDispatch();
  const volumePercent = useAppSelector(selectPlaybackVolumePercent);
  const [focusWithin, setFocusWithin] = useState(false);

  return (
    <motion.div
      animate={focusWithin ? "expanded" : "collapsed"}
      className="flex"
      initial="collapsed"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      onFocusCapture={() => setFocusWithin(true)}
      onWheel={(event) => {
        if (event.deltaY === 0) return;
        event.preventDefault();
        dispatch(playbackVolumeChanged(volumePercent + (event.deltaY < 0 ? 1 : -1)));
      }}
      whileHover="expanded"
    >
      <PlaybackVolumeControlToggle />
      <PlaybackVolumeControlSlider />
    </motion.div>
  );
}

function PlaybackVolumeControlToggle() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const volumePercent = useAppSelector(selectPlaybackVolumePercent);
  const enabled = volumePercent > 0;

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-label={enabled ? t("audio.actions.mute") : t("audio.actions.unmute")}
          aria-pressed={enabled}
          className={cn(enabled && "text-primary")}
          onClick={() => dispatch(playbackVolumeToggled())}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {enabled ? volumePercent >= 50 ? <Volume2 /> : <Volume1 /> : <VolumeOff />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled
          ? t("preview.tooltips.playbackVolumeMute")
          : t("preview.tooltips.playbackVolumeUnmute")}
      </TooltipContent>
    </Tooltip>
  );
}

function PlaybackVolumeControlSlider() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const volumePercent = useAppSelector(selectPlaybackVolumePercent);

  return (
    <motion.div
      className="flex h-full items-center overflow-hidden"
      transition={{ duration: 0.12 }}
      variants={{
        collapsed: { maxWidth: 0, opacity: 0 },
        expanded: { maxWidth: "11rem", opacity: 1 },
      }}
    >
      <div className="px-2">
        <div className="flex items-center">
          <Slider
            aria-label={t("preview.labels.playbackVolume")}
            className="w-30"
            max={100}
            min={0}
            onValueChange={([value]) => {
              if (value !== undefined) dispatch(playbackVolumeChanged(value));
            }}
            step={1}
            value={[volumePercent]}
          />
          <output className="w-9 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {volumePercent}%
          </output>
        </div>
      </div>
    </motion.div>
  );
}

export { TimelinePanel };
