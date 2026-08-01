import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

import {
  decibelsToVolumePercent,
  formatDecibels,
  MAX_SLIDER_DECIBELS,
  MIN_SLIDER_DECIBELS,
  volumePercentToDecibels,
} from "../utils/audio-level";
import styles from "./audio-level-control.module.css";

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
  const { t } = useTranslation();
  const decibels = volumePercentToDecibels(volumePercent);

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2", className)}>
      <Slider
        className={cn("min-w-0 flex-1", styles.slider)}
        min={MIN_SLIDER_DECIBELS}
        max={MAX_SLIDER_DECIBELS}
        step={0.5}
        value={[decibels]}
        onValueChange={([value]) => onChange(decibelsToVolumePercent(value ?? decibels))}
        onDoubleClick={() => onChange(50)}
        aria-label={label}
        title={t("audio.originalLevel")}
      />
      <output className="w-14 shrink-0 text-left font-mono text-xs text-muted-foreground">
        {formatDecibels(volumePercent)}
      </output>
    </div>
  );
}
