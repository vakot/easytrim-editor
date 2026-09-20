import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { optimizedExportSettingsChangedRequested } from "@/app/store/thunks/export-thunks";
import type { ExportSettings } from "@/domain/editing-instance";

import { FRAME_RATE_OPTIONS, rateFromValue } from "../../../lib/export-options.utils";

interface ExportFrameRateFormProps {
  settings: ExportSettings;
}

export function ExportFrameRateForm({ settings }: ExportFrameRateFormProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const frameRateValue = settings.frameRate
    ? `${settings.frameRate.numerator}/${settings.frameRate.denominator}`
    : "source";

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="export-frame-rate">{t("export.dialogs.optimized.frameRate")}</Label>
      <Select
        onValueChange={(value) =>
          void dispatch(
            optimizedExportSettingsChangedRequested({
              ...settings,
              frameRate: rateFromValue(value),
            }),
          )
        }
        value={frameRateValue}
      >
        <SelectTrigger className="w-full" id="export-frame-rate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="source">{t("export.dialogs.optimized.matchSource")}</SelectItem>
          {FRAME_RATE_OPTIONS.map((rate) => (
            <SelectItem key={rate} value={`${rate}/1`}>
              {t("export.options.framesPerSecond", { value: rate })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
