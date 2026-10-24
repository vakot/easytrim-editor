import { Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@easytrim-editor/ui/class-names";

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
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  type PlaybackSpeed,
} from "@/domain/playback-speed";

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
              aria-label={t("preview.playback.speed")}
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
        <TooltipContent>{t("preview.playback.playbackSpeedTooltip")}</TooltipContent>

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
              aria-label={t("preview.playback.speed")}
              aria-valuetext={`${speed}×`}
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

export { PlaybackSpeedControl };
