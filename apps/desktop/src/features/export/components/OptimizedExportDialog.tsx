import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MediaInfo } from "@/lib/tauri/media";

import type { ExportSettings } from "../types";
import {
  presetNameError,
  selectedExportPreset,
  type ExportPresetAction,
  type ExportPresetState,
} from "../export-presets";
import { FRAME_RATE_OPTIONS, rateFromValue, resolutionOptions } from "../utils/export-options";
import { useTranslation } from "react-i18next";

interface OptimizedExportDialogProps {
  open: boolean;
  source: MediaInfo;
  settings: ExportSettings;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: ExportSettings) => void;
  presetState: ExportPresetState;
  onPresetAction: (action: ExportPresetAction) => void;
  onExport: () => void;
}

export function OptimizedExportDialog({
  open,
  source,
  settings,
  onOpenChange,
  onSettingsChange,
  presetState,
  onPresetAction,
  onExport,
}: OptimizedExportDialogProps) {
  const { t } = useTranslation();
  const selectedPreset = selectedExportPreset(presetState);
  const [presetNameDraft, setPresetNameDraft] = useState({
    presetId: presetState.selectedPresetId,
    value: selectedPreset?.name ?? "",
  });
  const [presetError, setPresetError] = useState<string | null>(null);
  const presetName =
    presetNameDraft.presetId === presetState.selectedPresetId
      ? presetNameDraft.value
      : (selectedPreset?.name ?? "");
  const resolutionValue = `${settings.resolution.width}x${settings.resolution.height}`;
  const frameRateValue = settings.frameRate
    ? `${settings.frameRate.numerator}/${settings.frameRate.denominator}`
    : "source";

  function savePreset() {
    const error = presetNameError(
      presetState.presets,
      presetName,
      presetState.selectedPresetId ?? undefined,
    );
    if (error) {
      setPresetError(error);
      return;
    }
    onPresetAction({
      type: presetState.selectedPresetId ? "preset-updated" : "preset-created",
      name: presetName,
    });
    setPresetError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button aria-keyshortcuts="Control+E" title={t("export.exportShortcut")}>
          {t("export.export")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("export.export")}</DialogTitle>
          <DialogDescription>{t("export.dialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="export-preset">{t("export.presets.label", "Preset")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onPresetAction({ type: "preset-new-started" });
                  setPresetNameDraft({ presetId: null, value: "" });
                  setPresetError(null);
                }}
              >
                {t("export.presets.new", "New")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!presetState.selectedPresetId}
                onClick={() => onPresetAction({ type: "preset-deleted" })}
              >
                {t("export.presets.delete", "Delete")}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="export-preset-select">
                {t("export.presets.saved", "Saved presets")}
              </Label>
              <Select
                value={presetState.selectedPresetId ?? "new"}
                onValueChange={(value) => {
                  if (value !== "new") onPresetAction({ type: "preset-selected", presetId: value });
                }}
              >
                <SelectTrigger id="export-preset-select" className="w-full">
                  <SelectValue placeholder={t("export.presets.select", "Select a preset")} />
                </SelectTrigger>
                <SelectContent>
                  {presetState.presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="export-preset-name">{t("export.presets.name", "Name")}</Label>
              <Input
                id="export-preset-name"
                value={presetName}
                onChange={(event) =>
                  setPresetNameDraft({
                    presetId: presetState.selectedPresetId,
                    value: event.target.value,
                  })
                }
              />
            </div>
            <Button type="button" onClick={savePreset}>
              {t(
                presetState.selectedPresetId ? "export.presets.update" : "export.presets.create",
                presetState.selectedPresetId ? "Update preset" : "Create preset",
              )}
            </Button>
          </div>
          {presetError ? <p className="text-xs text-destructive">{presetError}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="export-resolution">{t("export.dialog.resolution")}</Label>
            <Select
              value={resolutionValue}
              onValueChange={(value) => {
                const [width, height] = value.split("x").map(Number);
                if (width && height) {
                  onSettingsChange({ ...settings, resolution: { width, height } });
                }
              }}
            >
              <SelectTrigger id="export-resolution" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutionOptions(source, t).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <div className="grid gap-1.5">
          <Label htmlFor="export-arguments">{t("export.dialog.arguments")}</Label>
          <Textarea
            id="export-arguments"
            className="min-h-28 resize-y font-mono text-xs"
            value={settings.argumentsText}
            onChange={(event) =>
              onSettingsChange({ ...settings, argumentsText: event.target.value })
            }
          />
        </div>
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
