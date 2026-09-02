import { Link2, Unlink2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import { selectCropResolution } from "@/app/store/slices/crop-slice";
import { selectExportArguments } from "@/app/store/slices/export-presets-slice";
import {
  optimizedExportDialogClosed,
  selectExportCommandPreview,
  selectExportCommandPreviewError,
  selectExportLaunchError,
  selectOptimizedExportDialogOpen,
} from "@/app/store/slices/export-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import {
  openOptimizedExportDialog,
  optimizedExportSettingsChangedRequested,
  refreshOptimizedExportPlan,
  startOptimizedExportRequested,
} from "@/app/store/thunks/export-thunks";

import { CommandPreview } from "./components/CommandPreview";
import { PresetManager } from "./components/PresetManager";
import { FRAME_RATE_OPTIONS, rateFromValue, resolutionOptions } from "./lib/export-options.utils";

export function ExportDialog() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectOptimizedExportDialogOpen);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const source = useAppSelector(selectSourceMedia);
  const cropResolution = useAppSelector(selectCropResolution);
  const settings = activeInstance
    ? activeInstance.optimizedSettings ?? { frameRate: undefined, resolution: cropResolution }
    : null;
  const argumentsText = useAppSelector(selectExportArguments);
  const commandPreview = useAppSelector(selectExportCommandPreview);
  const commandPreviewError = useAppSelector(selectExportCommandPreviewError);
  const launchError = useAppSelector(selectExportLaunchError);
  const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true);
  const previousArgumentsText = useRef(argumentsText);

  useEffect(() => {
    if (previousArgumentsText.current === argumentsText) return;
    previousArgumentsText.current = argumentsText;
    if (open) void dispatch(refreshOptimizedExportPlan());
  }, [argumentsText, dispatch, open]);

  if (!source || !settings) return null;

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      void dispatch(openOptimizedExportDialog());
    } else {
      dispatch(optimizedExportDialogClosed());
    }
  };

  const resolutionValue = `${settings.resolution.width}x${settings.resolution.height}`;
  const resolutionPresets = resolutionOptions(cropResolution, t);
  const hasMatchingResolutionPreset = resolutionPresets.some(
    (option) => option.value === resolutionValue,
  );

  const cropAspectRatio = cropResolution.width / cropResolution.height;
  const frameRateValue = settings.frameRate
    ? `${settings.frameRate.numerator}/${settings.frameRate.denominator}`
    : "source";

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("export.actions.start")}</DialogTitle>
            <DialogDescription>{t("export.dialogs.optimized.description")}</DialogDescription>
          </DialogHeader>
          <PresetManager />
          <div className="grid gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="export-resolution">
                  {t("export.dialogs.optimized.resolution")}
                </Label>
                <Select
                  onValueChange={(value) => {
                    const [width, height] = value.split("x").map(Number);
                    if (width && height) {
                      void dispatch(
                        optimizedExportSettingsChangedRequested({
                          ...settings,
                          resolution: { width, height },
                        }),
                      );
                    }
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
              </div>
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
                      void dispatch(
                        optimizedExportSettingsChangedRequested({
                          ...settings,
                          resolution: {
                            width,
                            height: isAspectRatioLocked
                              ? Math.max(1, Math.round(width / cropAspectRatio))
                              : settings.resolution.height,
                          },
                        }),
                      );
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
                      void dispatch(
                        optimizedExportSettingsChangedRequested({
                          ...settings,
                          resolution: {
                            width: isAspectRatioLocked
                              ? Math.max(1, Math.round(height * cropAspectRatio))
                              : settings.resolution.width,
                            height,
                          },
                        }),
                      );
                    }}
                    type="number"
                    value={settings.resolution.height}
                  />
                  <Tooltip>
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
                  <SelectItem value="source">
                    {t("export.dialogs.optimized.matchSource")}
                  </SelectItem>
                  {FRAME_RATE_OPTIONS.map((rate) => (
                    <SelectItem key={rate} value={`${rate}/1`}>
                      {t("export.options.framesPerSecond", { value: rate })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CommandPreview command={commandPreview} error={commandPreviewError?.message} />
          <p className="text-xs text-muted-foreground">
            {t("export.dialogs.optimized.saveNotice")}
          </p>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => void dispatch(startOptimizedExportRequested())}>
              {t("export.actions.start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {launchError ? (
        <Alert className="absolute top-full right-5 z-40 mt-2 w-80" variant="destructive">
          <AlertDescription>{launchError.message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
