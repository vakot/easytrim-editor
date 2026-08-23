import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaInfo } from "@/lib/tauri/media";

import type { ExportSettings } from "../types";
import type { ExportPresetAction, ExportPresetState } from "../export-presets";
import { PresetManager } from "./PresetManager";
import { CommandPreview } from "./CommandPreview";
import { FRAME_RATE_OPTIONS, rateFromValue, resolutionOptions } from "../utils/export-options";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link2, Unlink2 } from "lucide-react";
import { useState } from "react";

interface OptimizedExportDialogProps {
  open: boolean;
  source: MediaInfo;
  settings: ExportSettings;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: ExportSettings) => void;
  presetState: ExportPresetState;
  onPresetAction: (action: ExportPresetAction) => void;
  commandPreview: string;
  commandPreviewError: string | null;
  onExport: () => void;
  showTrigger?: boolean;
}

export function OptimizedExportDialog({
  open,
  source,
  settings,
  onOpenChange,
  onSettingsChange,
  presetState,
  onPresetAction,
  commandPreview,
  commandPreviewError,
  onExport,
  showTrigger = true,
}: OptimizedExportDialogProps) {
  const { t } = useTranslation();
  const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true);
  const resolutionValue = `${settings.resolution.width}x${settings.resolution.height}`;
  const resolutionPresets = resolutionOptions(source, t);
  const hasMatchingResolutionPreset = resolutionPresets.some(
    (option) => option.value === resolutionValue,
  );
  const sourceAspectRatio = source.video.width / source.video.height;
  const frameRateValue = settings.frameRate
    ? `${settings.frameRate.numerator}/${settings.frameRate.denominator}`
    : "source";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button aria-keyshortcuts="Control+E">{t("export.export")}</Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("export.exportTooltip")}</TooltipContent>
        </Tooltip>
      ) : null}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("export.export")}</DialogTitle>
          <DialogDescription>{t("export.dialog.description")}</DialogDescription>
        </DialogHeader>
        <PresetManager state={presetState} onAction={onPresetAction} />
        <div className="grid gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="export-resolution">{t("export.dialog.resolution")}</Label>
              <Select
                value={hasMatchingResolutionPreset ? resolutionValue : "custom"}
                onValueChange={(value) => {
                  const [width, height] = value.split("x").map(Number);
                  if (width && height) {
                    onSettingsChange({ ...settings, resolution: { width, height } });
                  }
                }}
              >
                <SelectTrigger id="export-resolution" className="w-full">
                  <SelectValue>
                    {!hasMatchingResolutionPreset ? "Custom scaling" : undefined}
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
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="sr-only" htmlFor="export-width">
                Width
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="export-width"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={settings.resolution.width}
                  onChange={(event) => {
                    const width = Number(event.target.value);
                    if (!Number.isInteger(width) || width <= 0) return;
                    onSettingsChange({
                      ...settings,
                      resolution: {
                        width,
                        height: isAspectRatioLocked
                          ? Math.max(1, Math.round(width / sourceAspectRatio))
                          : settings.resolution.height,
                      },
                    });
                  }}
                />
                <span aria-hidden="true">×</span>
                <Input
                  aria-label="Height"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={settings.resolution.height}
                  onChange={(event) => {
                    const height = Number(event.target.value);
                    if (!Number.isInteger(height) || height <= 0) return;
                    onSettingsChange({
                      ...settings,
                      resolution: {
                        width: isAspectRatioLocked
                          ? Math.max(1, Math.round(height * sourceAspectRatio))
                          : settings.resolution.width,
                        height,
                      },
                    });
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={isAspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                      aria-pressed={isAspectRatioLocked}
                      onClick={() => setIsAspectRatioLocked((locked) => !locked)}
                      className={isAspectRatioLocked ? "text-primary" : undefined}
                    >
                      {isAspectRatioLocked ? <Link2 /> : <Unlink2 />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAspectRatioLocked ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="export-frame-rate">{t("export.dialog.frameRate")}</Label>
            <Select
              value={frameRateValue}
              onValueChange={(value) =>
                onSettingsChange({ ...settings, frameRate: rateFromValue(value) })
              }
            >
              <SelectTrigger id="export-frame-rate" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="source">{t("export.dialog.matchSource")}</SelectItem>
                {FRAME_RATE_OPTIONS.map((rate) => (
                  <SelectItem key={rate} value={`${rate}/1`}>
                    {t("export.framesPerSecond", { value: rate })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CommandPreview command={commandPreview} error={commandPreviewError} />
        <p className="text-xs text-muted-foreground">{t("export.dialog.saveNotice")}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onExport}>{t("export.export")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
