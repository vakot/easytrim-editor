import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { OptimizedExportDialog } from "./components/OptimizedExportDialog";
import { useExportController } from "./hooks/useExportController";
import type { ExportPanelProps } from "./types";
import { useTranslation } from "react-i18next";

export function ExportPanel(props: ExportPanelProps) {
  const { t } = useTranslation();
  const exportController = useExportController(props);

  return (
    <div className="flex items-center gap-3">
      <Separator orientation="vertical" className="h-full" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={() => void exportController.startFastCut()}
            aria-keyshortcuts="Control+S"
          >
            {t("export.save")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("export.saveTooltip")}</TooltipContent>
      </Tooltip>
      <OptimizedExportDialog
        open={exportController.isOptimizedOpen}
        source={props.source}
        settings={exportController.settings}
        onOpenChange={exportController.setIsOptimizedOpen}
        onSettingsChange={exportController.setSettings}
        presetState={props.presetState}
        onPresetAction={props.onPresetAction}
        commandPreview={exportController.commandPreview}
        commandPreviewError={exportController.commandPreviewError}
        onExport={() => void exportController.startOptimizedRender()}
      />
      {exportController.launchError ? (
        <Alert variant="destructive" className="absolute top-full right-5 z-40 mt-2 w-80">
          <AlertDescription>{exportController.launchError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { ExportQueue } from "./components/ExportQueue";
export type { ExportToast } from "./types";
