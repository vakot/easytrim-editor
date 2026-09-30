import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useNormalizeLoudnessContext } from "../contexts/normalize-loudness-context";

function NormalizeLoudnessCustomSettings({ streamIndex }: { streamIndex: number }) {
  const { t } = useTranslation();
  const { dispatchForm, form } = useNormalizeLoudnessContext();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor={`track-custom-lufs-${streamIndex}`}>{t("audio.labels.targetLufs")}</Label>
        <Input
          id={`track-custom-lufs-${streamIndex}`}
          max={-5}
          min={-36}
          onChange={(event) =>
            dispatchForm({ type: "targetChanged", value: event.currentTarget.value })
          }
          onKeyDown={(event) => event.stopPropagation()}
          step={0.1}
          type="number"
          value={form.targetLufsInput}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`track-custom-peak-${streamIndex}`}>
          {t("audio.labels.maximumTruePeak")}
        </Label>
        <Input
          id={`track-custom-peak-${streamIndex}`}
          max={0}
          min={-9}
          onChange={(event) =>
            dispatchForm({ type: "peakChanged", value: event.currentTarget.value })
          }
          onKeyDown={(event) => event.stopPropagation()}
          step={0.1}
          type="number"
          value={form.maxTruePeakDbInput}
        />
      </div>
    </div>
  );
}

export { NormalizeLoudnessCustomSettings };
