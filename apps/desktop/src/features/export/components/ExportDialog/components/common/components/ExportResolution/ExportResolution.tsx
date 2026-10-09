import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { exportSettingsChangedRequested } from "@/app/store/thunks/export-thunks";
import type { ExportSettings } from "@/domain/editing-instance";

import { resolutionOptions } from "../../../../../../lib/export-options.utils";

import { ResolutionDimensions } from "./components/ResolutionDimensions";
import { ResolutionPresetSelect } from "./components/ResolutionPresetSelect";

function ExportResolution({
  cropResolution,
  settings,
}: {
  cropResolution: ExportSettings["resolution"];
  settings: ExportSettings;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true);
  const resolutionValue = `${settings.resolution.width}x${settings.resolution.height}`;
  const resolutionPresets = resolutionOptions(cropResolution, t);
  const hasMatchingResolutionPreset = resolutionPresets.some(
    (option) => option.value === resolutionValue,
  );

  const cropAspectRatio = cropResolution.width / cropResolution.height;

  const updateResolution = (resolution: ExportSettings["resolution"]) => {
    void dispatch(
      exportSettingsChangedRequested({
        ...settings,
        resolution,
      }),
    );
  };

  return (
    <section className="grid gap-1.5">
      <Label htmlFor="export-resolution">{t("export.resolution.label")}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
        <ResolutionPresetSelect
          hasMatchingResolutionPreset={hasMatchingResolutionPreset}
          onValueChange={(value) => {
            const [width, height] = value.split("x").map(Number);
            if (width && height) updateResolution({ width, height });
          }}
          options={resolutionPresets}
          resolutionValue={resolutionValue}
        />
        <ResolutionDimensions
          cropAspectRatio={cropAspectRatio}
          isAspectRatioLocked={isAspectRatioLocked}
          onAspectRatioLockChange={setIsAspectRatioLocked}
          onResolutionChange={updateResolution}
          settings={settings}
        />
      </div>
    </section>
  );
}

export { ExportResolution };
