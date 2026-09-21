import { Link2, Unlink2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ExportSettings } from "@/domain/editing-instance";

interface ResolutionDimensionsProps {
  cropAspectRatio: number;
  isAspectRatioLocked: boolean;
  onAspectRatioLockChange: (locked: boolean) => void;
  onResolutionChange: (resolution: ExportSettings["resolution"]) => void;
  settings: ExportSettings;
}

function ResolutionDimensions({
  cropAspectRatio,
  isAspectRatioLocked,
  onAspectRatioLockChange,
  onResolutionChange,
  settings,
}: ResolutionDimensionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5">
      <Label className="sr-only" htmlFor="export-width">
        {t("export.labels.width")}
      </Label>
      <div className="flex flex-1 items-center gap-1.5">
        <Input
          className="flex-1"
          id="export-width"
          inputMode="numeric"
          min={1}
          onChange={(event) => {
            const width = Number(event.target.value);
            if (!Number.isInteger(width) || width <= 0) return;
            onResolutionChange({
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
          className="flex-1"
          inputMode="numeric"
          min={1}
          onChange={(event) => {
            const height = Number(event.target.value);
            if (!Number.isInteger(height) || height <= 0) return;
            onResolutionChange({
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
              onClick={() => onAspectRatioLockChange(!isAspectRatioLocked)}
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
  );
}

export { ResolutionDimensions };
