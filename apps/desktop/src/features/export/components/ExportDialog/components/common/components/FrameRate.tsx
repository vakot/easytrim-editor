import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Autocomplete } from "@/components/ui/autocomplete";
import { Label } from "@/components/ui/label";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { exportSettingsChangedRequested } from "@/app/store/thunks/export-thunks";
import type { ExportSettings } from "@/domain/editing-instance";

import {
  FRAME_RATE_OPTIONS,
  frameRateFromInput,
  frameRateToInput,
} from "../../../../../lib/export-options.utils";

function FrameRate({
  onValidityChange,
  settings,
}: {
  onValidityChange: (isValid: boolean) => void;
  settings: ExportSettings;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceLabel = t("export.optimized.dialog.matchSource");
  const [value, setValue] = useState(() => frameRateToInput(settings.frameRate));
  const isValid = value === "" || frameRateFromInput(value) !== undefined;
  const errorId = "export-frame-rate-error";

  useEffect(() => {
    onValidityChange(isValid);
  }, [isValid, onValidityChange]);

  const onValueChange = (nextValue: string) => {
    setValue(nextValue);
    const frameRate = nextValue === "" ? undefined : frameRateFromInput(nextValue);
    if (nextValue === "" || frameRate) {
      void dispatch(exportSettingsChangedRequested({ ...settings, frameRate }));
    }
  };

  return (
    <section className="grid gap-1.5">
      <Label htmlFor="export-frame-rate">{t("export.frameRate.label")}</Label>
      <Autocomplete
        {...(isValid ? {} : { "aria-describedby": errorId, "aria-invalid": true })}
        id="export-frame-rate"
        label={t("export.frameRate.label")}
        onValueChange={onValueChange}
        placeholder={sourceLabel}
        suggestions={FRAME_RATE_OPTIONS.map((rate) => t("export.frameRate.value", { value: rate }))}
        value={value}
      />
      {!isValid ? (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {t("export.frameRate.invalidValue")}
        </p>
      ) : null}
    </section>
  );
}

export { FrameRate };
