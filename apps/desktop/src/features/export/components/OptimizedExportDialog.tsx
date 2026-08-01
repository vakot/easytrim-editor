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
  const resolutionValue = `${settings.resolution.width}x${settings.resolution.height}`;
  const frameRateValue = settings.frameRate
    ? `${settings.frameRate.numerator}/${settings.frameRate.denominator}`
    : "source";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button aria-keyshortcuts="Control+E" title="Export (Ctrl+E)">
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Configure the optimized render before choosing its file.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="export-resolution">Resolution</Label>
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
                {resolutionOptions(source).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="export-frame-rate">Frame rate</Label>
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
                <SelectItem value="source">Match source</SelectItem>
                {FRAME_RATE_OPTIONS.map((rate) => (
                  <SelectItem key={rate} value={`${rate}/1`}>
                    {rate} FPS
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="export-arguments">FFmpeg arguments</Label>
          <Textarea
            id="export-arguments"
            className="min-h-28 resize-y font-mono text-xs"
            value={settings.argumentsText}
            onChange={(event) =>
              onSettingsChange({ ...settings, argumentsText: event.target.value })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The native save dialog opens after confirmation.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onExport}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
