import { Link2, Unlink2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { optimizedExportSettingsChangedRequested } from "@/app/store/thunks/export-thunks";
import type { ExportSettings } from "@/domain/editing-instance";

import { resolutionOptions } from "../../../lib/export-options.utils";

interface ExportResolutionFormProps {
  cropResolution: ExportSettings["resolution"];
  settings: ExportSettings;
}

export function ExportResolutionForm({ cropResolution, settings }: ExportResolutionFormProps) {
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
      optimizedExportSettingsChangedRequested({
        ...settings,
        resolution,
      }),
    );
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="export-resolution">{t("export.dialogs.optimized.resolution")}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
        <Select
          onValueChange={(value) => {
            const [width, height] = value.split("x").map(Number);
            if (width && height) updateResolution({ width, height });
          }}
          value={hasMatchingResolutionPreset ? resolutionValue : "custom"}
        >
          <SelectTrigger className="w-full" id="export-resolution">
            <SelectValue>
              {!hasMatchingResolutionPreset ? t("export.labels.customScaling") : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {resolutionPresets.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Label className="sr-only" htmlFor="export-width">
            {t("export.labels.width")}
          </Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="export-width"
              inputMode="numeric"
              min={1}
              onChange={(event) => {
                const width = Number(event.target.value);
                if (!Number.isInteger(width) || width <= 0) return;
                updateResolution({
                  width,
                  height: isAspectRatioLocked
                    ? Math.max(1, Math.round(width / cropAspectRatio))
                    : settings.resolution.height,
                });
              }}
              type="number"
              value={settings.resolution.width}
            />
            <span aria-hidden="true">×</span>
            <Input
              aria-label={t("export.labels.height")}
              inputMode="numeric"
              min={1}
              onChange={(event) => {
                const height = Number(event.target.value);
                if (!Number.isInteger(height) || height <= 0) return;
                updateResolution({
                  width: isAspectRatioLocked
                    ? Math.max(1, Math.round(height * cropAspectRatio))
                    : settings.resolution.width,
                  height,
                });
              }}
              type="number"
              value={settings.resolution.height}
            />
            <Tooltip preserveOnTrigger>
              <TooltipTrigger asChild>
                <Button
                  aria-label={
                    isAspectRatioLocked
                      ? t("export.accessibility.unlockAspectRatio")
                      : t("export.accessibility.lockAspectRatio")
                  }
                  aria-pressed={isAspectRatioLocked}
                  className={isAspectRatioLocked ? "text-primary" : undefined}
                  onClick={() => setIsAspectRatioLocked((locked) => !locked)}
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  {isAspectRatioLocked ? <Link2 /> : <Unlink2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isAspectRatioLocked
                  ? t("export.tooltips.aspectRatioLocked")
                  : t("export.tooltips.aspectRatioUnlocked")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
