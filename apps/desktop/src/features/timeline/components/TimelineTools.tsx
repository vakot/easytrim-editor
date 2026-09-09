import { BetweenVerticalStart, Gauge, Magnet, Repeat, RotateCcw } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  createEditorToolsStateFromPreferences,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  segmentPlaybackToggled,
  selectLoopPlaybackEnabled,
  selectPlaybackSpeed,
  selectSegmentPlaybackEnabled,
  selectSnapPlaybackEnabled,
  snapPlaybackToggled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPreferences } from "@/app/store/slices/preferences-slice";
import {
  DEFAULT_PLAYBACK_SPEED,
  getPlaybackSpeedStepIndex,
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  normalizePlaybackSpeed,
  PLAYBACK_SPEED_STEPS,
} from "@/domain/playback-speed";

const PLAYBACK_SPEED_MARKERS = ([0.5, 1, 1.5, 2, 3] as const).map((speed) => ({
  value: PLAYBACK_SPEED_STEPS.indexOf(speed),
  label: `${speed}×`,
}));

export function TimelineTools() {
  return (
    <>
      <div className="grid auto-cols-7 grid-flow-col grid-rows-[repeat(2,1.75rem)] gap-1">
        <SnapPlaybackTool />
        <LoopPlaybackTool />
        <SegmentPlaybackTool />
        <PlaybackSpeedTool />
      </div>
      <Separator
        aria-hidden="true"
        className="mx-1"
        data-slot="timeline-tools-divider"
        orientation="vertical"
      />
      <div className="shrink-0 self-start">
        <ResetToolsTool />
      </div>
    </>
  );
}

function SnapPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectSnapPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.labels.snapPlayback")}
      onClick={() => dispatch(snapPlaybackToggled())}
      title={enabled ? t("preview.tooltips.snapEnabled") : t("preview.tooltips.snapDisabled")}
    >
      <Magnet />
    </TimelineToolButton>
  );
}

function LoopPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectLoopPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.labels.loopPlayback")}
      onClick={() => dispatch(loopPlaybackToggled())}
      title={enabled ? t("preview.tooltips.loopEnabled") : t("preview.tooltips.loopDisabled")}
    >
      <Repeat />
    </TimelineToolButton>
  );
}

function SegmentPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectSegmentPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.labels.segmentPlayback")}
      onClick={() => dispatch(segmentPlaybackToggled())}
      title={enabled ? t("preview.tooltips.segmentEnabled") : t("preview.tooltips.segmentDisabled")}
    >
      <BetweenVerticalStart />
    </TimelineToolButton>
  );
}

function PlaybackSpeedTool() {
  const { t } = useTranslation();
  const speed = useAppSelector(selectPlaybackSpeed);
  const dispatch = useAppDispatch();
  const stepIndex = getPlaybackSpeedStepIndex(speed);
  const enabled = speed !== DEFAULT_PLAYBACK_SPEED;

  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label={t("preview.labels.playbackSpeed")}
              aria-pressed={enabled}
              className={enabled ? "text-primary aria-expanded:text-primary" : undefined}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <Gauge />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("preview.tooltips.playbackSpeed")}</TooltipContent>
        <PopoverContent align="center" className="w-56 p-2.5" side="bottom">
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
            <PlaybackSpeedInput
              onSpeedChange={(nextSpeed) => dispatch(playbackSpeedChanged(nextSpeed))}
              speed={speed}
            />
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
}

function PlaybackSpeedInput({
  onSpeedChange,
  speed,
}: {
  onSpeedChange: (speed: number) => void;
  speed: number;
}) {
  const { t } = useTranslation();
  const [draftSpeed, setDraftSpeed] = useState<string | null>(null);

  const commitSpeed = () => {
    const nextSpeed = normalizePlaybackSpeed(Number(draftSpeed ?? speed));
    if (nextSpeed === null) {
      setDraftSpeed(null);
      return;
    }

    onSpeedChange(nextSpeed);
    setDraftSpeed(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  return (
    <div className="group relative h-8 w-16 shrink-0">
      <output
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end font-mono text-xs text-muted-foreground transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
      >
        {speed.toFixed(2)}×
      </output>
      <Input
        aria-label={t("preview.labels.playbackSpeed")}
        className="absolute inset-0 h-8 w-full px-1 text-right font-mono text-xs opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
        inputMode="decimal"
        max={MAX_PLAYBACK_SPEED}
        min={MIN_PLAYBACK_SPEED}
        onBlur={commitSpeed}
        onChange={(event) => setDraftSpeed(event.target.value)}
        onFocus={(event) => {
          setDraftSpeed(speed.toString());
          event.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        step="any"
        type="number"
        value={draftSpeed ?? speed.toString()}
      />
    </div>
  );
}

function ResetToolsTool() {
  const { t } = useTranslation();
  const preferences = useAppSelector(selectPreferences);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={false}
      label={t("preview.actions.resetTools")}
      onClick={() => dispatch(editorToolsReset(createEditorToolsStateFromPreferences(preferences)))}
      preserveOnTrigger={false}
      title={t("preview.actions.resetTools")}
    >
      <RotateCcw />
    </TimelineToolButton>
  );
}

function TimelineToolButton({
  children,
  enabled,
  label,
  onClick,
  preserveOnTrigger = true,
  title,
}: {
  children: React.ReactNode;
  enabled: boolean;
  label: string;
  onClick: () => void;
  preserveOnTrigger?: boolean;
  title: string;
}) {
  return (
    <Tooltip preserveOnTrigger={preserveOnTrigger}>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={enabled}
          className={enabled ? "text-primary" : undefined}
          onClick={onClick}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
