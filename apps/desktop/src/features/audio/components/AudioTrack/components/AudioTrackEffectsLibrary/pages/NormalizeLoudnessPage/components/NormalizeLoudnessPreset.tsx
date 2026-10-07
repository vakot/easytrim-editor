import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LoudnessPreset } from "@/domain/audio-processing";

import { useNormalizeLoudnessContext } from "../contexts/normalize-loudness-context";
import { formatNormalizationPreset } from "../lib/normalize-loudness.utils";
import { NORMALIZATION_PRESETS } from "../lib/normalize-loudness-form";

function NormalizeLoudnessPreset({ streamIndex }: { streamIndex: number }) {
  const { i18n, t } = useTranslation();
  const { dispatchForm, selectedPreset } = useNormalizeLoudnessContext();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`track-loudness-preset-${streamIndex}`}>
        {t("audio.normalization.preset.label")}
      </Label>
      <div className="flex items-center">
        <Select
          onValueChange={(value) => {
            if (value === "custom" || NORMALIZATION_PRESETS.includes(value as LoudnessPreset)) {
              dispatchForm({ type: "presetChanged", value: value as "custom" | LoudnessPreset });
            }
          }}
          value={selectedPreset}
        >
          <SelectTrigger
            aria-label={`${t("audio.normalization.preset.label")}: ${t("audio.normalization.label")}`}
            className="min-w-0 flex-1"
            id={`track-loudness-preset-${streamIndex}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NORMALIZATION_PRESETS.map((preset) => (
              <SelectItem className="whitespace-nowrap" key={preset} value={preset}>
                {formatNormalizationPreset(preset, i18n.language, t)}
              </SelectItem>
            ))}
            <SelectItem className="whitespace-nowrap" value="custom">
              {t("audio.normalization.preset.custom")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { NormalizeLoudnessPreset };
