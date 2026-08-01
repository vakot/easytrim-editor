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
import { FRAME_RATE_OPTIONS, rateFromValue, resolutionOptions } from "../utils/export-options";
import { useTranslation } from "react-i18next";

interface OptimizedExportDialogProps {
  open: boolean;
  source: MediaInfo;
  settings: ExportSettings;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: ExportSettings) => void;
  onExport: () => void;
}

export function OptimizedExportDialog({
  open,
  source,
  settings,
  onOpenChange,
  onSettingsChange,
  onExport,
}: OptimizedExportDialogProps) {
  const { t } = useTranslation();
  const resolutionValue = `${settings.resolution.width}x${settings.resolution.height}`;
  const frameRateValue = settings.frameRate
    ? `${settings.frameRate.numerator}/${settings.frameRate.denominator}`
    : "source";

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
