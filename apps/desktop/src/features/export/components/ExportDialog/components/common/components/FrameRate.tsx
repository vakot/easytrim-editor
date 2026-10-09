import { ChevronsUpDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Autocomplete,
  AutocompleteAnchor,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { InputGroupAddon } from "@/components/ui/input-group";
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
      <Autocomplete label={t("export.frameRate.label")}>
        <AutocompleteAnchor>
          <div className="flex items-center gap-2">
            <AutocompleteInputGroup className="flex-1">
              <AutocompleteInput
                {...(isValid ? {} : { "aria-describedby": errorId, "aria-invalid": true })}
                aria-label={t("export.frameRate.label")}
                id="export-frame-rate"
                onValueChange={onValueChange}
                placeholder={t("export.optimized.dialog.matchSource")}
                value={value}
              />

              <InputGroupAddon align="inline-end">
                <ChevronsUpDown />
              </InputGroupAddon>
            </AutocompleteInputGroup>

            <Button
              aria-label={t("common.actions.clear")}
              onClick={() => onValueChange("")}
              size="icon"
              type="button"
              variant="secondary"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </AutocompleteAnchor>

        <AutocompleteContent>
          <AutocompleteEmpty>Custom framerate will be applied</AutocompleteEmpty>
          <AutocompleteList>
            {FRAME_RATE_OPTIONS.map((rate) => (
              <AutocompleteItem key={rate} onSelect={onValueChange} value={String(rate)}>
                {t("export.frameRate.value", { value: rate })}
              </AutocompleteItem>
            ))}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
      {!isValid ? (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {t("export.frameRate.invalidValue")}
        </p>
      ) : null}
    </section>
  );
}

export { FrameRate };
