import type { TFunction } from "i18next";

import { loudnessNormalizationTargets, type LoudnessPreset } from "@/domain/audio-processing";
import type { LoudnessAnalysis } from "@/domain/media";

import { normalizationPresetLabel } from "../../../../../../../lib/audio-level.utils";

function formatNormalizationPreset(preset: LoudnessPreset, language: string, t: TFunction): string {
  const { maxTruePeakDb, targetLufs } = loudnessNormalizationTargets(preset);
  const format = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value).replace(/-/g, "−");

  return `${normalizationPresetLabel(preset, t)} · ${t("audio.normalization.messages.normalizedLevelSummary", { peak: format(maxTruePeakDb), target: format(targetLufs) })}`;
}

function formatLoudnessAnalysis(analysis: LoudnessAnalysis, language: string): string {
  const format = (value: number | undefined, unit: string) => {
    if (value === undefined) return `— ${unit}`;
    const formatted = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
    return `${formatted.replace(/-/g, "−")} ${unit}`;
  };

  return `${format(analysis.integratedLufs, "LUFS")} · ${format(analysis.truePeakDb, "dBTP")}`;
}

export { formatLoudnessAnalysis, formatNormalizationPreset };
