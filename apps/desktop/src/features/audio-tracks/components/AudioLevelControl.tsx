import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import {
  decibelsToVolumePercent,
  formatDecibels,
  MAX_SLIDER_DECIBELS,
  MIN_SLIDER_DECIBELS,
  volumePercentToDecibels,
} from "../utils/audio-level";

interface AudioLevelControlProps {
  label: string;
  volumePercent: number;
  onChange: (volumePercent: number) => void;
  className?: string;
}

export function AudioLevelControl({
  label,
  volumePercent,
  onChange,
  className,
}: AudioLevelControlProps) {
  const decibels = volumePercentToDecibels(volumePercent);

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2", className)}>
      <Slider
        className="min-w-0 flex-1"
        min={MIN_SLIDER_DECIBELS}
        max={MAX_SLIDER_DECIBELS}
        step={0.5}
        value={[decibels]}
        onValueChange={([value]) => onChange(decibelsToVolumePercent(value ?? decibels))}
        onDoubleClick={() => onChange(50)}
        aria-label={label}
        markers={[{ value: 0, label: "0 dB" }]}
      />
      <output className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {formatDecibels(volumePercent)}
      </output>
    </div>
  );
}
