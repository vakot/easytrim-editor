import { Slider } from "@/components/ui/slider";

import { cn } from "@/lib/class-names.utils";

import {
  decibelsToVolumePercent,
  formatDecibels,
  MAX_SLIDER_DECIBELS,
  MIN_SLIDER_DECIBELS,
  volumePercentToDecibels,
} from "../lib/audio-level.utils";

interface AudioLevelControlProps {
  className?: string;
  label: string;
  onChange: (volumePercent: number) => void;
  onCommit?: () => void;
  volumePercent: number;
}

export function AudioLevelControl({
  className,
  label,
  onChange,
  onCommit,
  volumePercent,
}: AudioLevelControlProps) {
  const decibels = volumePercentToDecibels(volumePercent);

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2", className)}>
      <Slider
        aria-label={label}
        className="min-w-0 flex-1"
        markers={[
          { value: 0, label: "0 dB" },
          { value: MIN_SLIDER_DECIBELS, label: "−∞" },
        ]}
        max={MAX_SLIDER_DECIBELS}
        min={MIN_SLIDER_DECIBELS}
        onDoubleClick={() => {
          onChange(50);
          onCommit?.();
        }}
        onKeyUp={() => onCommit?.()}
        onPointerUp={() => onCommit?.()}
        onValueChange={([value]) => onChange(decibelsToVolumePercent(value ?? decibels))}
        step={0.5}
        value={[decibels]}
      />
      <output className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {formatDecibels(volumePercent)}
      </output>
    </div>
  );
}
