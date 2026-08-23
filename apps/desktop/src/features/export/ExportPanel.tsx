import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { forwardRef, useImperativeHandle } from "react";

import { OptimizedExportDialog } from "./components/OptimizedExportDialog";
import { useExportController } from "./hooks/useExportController";
import type { ExportPanelHandle, ExportPanelProps } from "./types";
import { useTranslation } from "react-i18next";

interface ExportPanelRenderProps {
  showActions?: boolean;
}

export const ExportPanel = forwardRef<ExportPanelHandle, ExportPanelProps & ExportPanelRenderProps>(
  function ExportPanel({ showActions = true, ...props }, ref) {
    const { t } = useTranslation();
    const exportController = useExportController(props);
    const cropApplied = props.crop
      ? props.crop.x !== 0 ||
        props.crop.y !== 0 ||
        props.crop.width !== 1 ||
        props.crop.height !== 1
      : false;

    useImperativeHandle(
      ref,
      () => ({
        startFastCut: () => void exportController.startFastCut(),
        openOptimizedDialog: exportController.openOptimizedDialog,
      }),
      [exportController],
    );

    return (
      <>
        {showActions ? (
          <div className="flex items-center gap-3">
            <Separator orientation="vertical" className="h-auto self-stretch" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    onClick={() => void exportController.startFastCut()}
                    aria-keyshortcuts="Control+S"
                    disabled={cropApplied}
                  >
                    {t("export.save")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {cropApplied ? t("export.cropSaveDisabledTooltip") : t("export.saveTooltip")}
              </TooltipContent>
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
        ) : (
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
            showTrigger={false}
          />
        )}
        {!showActions && exportController.launchError ? (
          <Alert variant="destructive" className="absolute top-full right-5 z-40 mt-2 w-80">
            <AlertDescription>{exportController.launchError}</AlertDescription>
          </Alert>
        ) : null}
      </>
    );
  },
);

export { ExportQueue } from "./components/ExportQueue";
export type { ExportToast } from "./types";
