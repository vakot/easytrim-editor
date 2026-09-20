import { useEffect, useRef } from "react";
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

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropResolution } from "@/app/store/slices/crop-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
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
  refreshOptimizedExportPlan,
  startOptimizedExportRequested,
} from "@/app/store/thunks/export-thunks";

import { CommandPreview } from "./components/CommandPreview";
import { ExportFrameRate } from "./components/ExportFrameRate";
import { ExportResolution } from "./components/ExportResolution";
import { PresetManager } from "./components/PresetManager";

export function ExportDialog() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectOptimizedExportDialogOpen);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const source = useAppSelector(selectSourceMedia);
  const cropResolution = useAppSelector(selectCropResolution);
  const settings = activeInstance
    ? (activeInstance.optimizedSettings ?? { frameRate: undefined, resolution: cropResolution })
    : null;

  const argumentsText = useAppSelector(selectExportArguments);
  const commandPreview = useAppSelector(selectExportCommandPreview);
  const commandPreviewError = useAppSelector(selectExportCommandPreviewError);
  const launchError = useAppSelector(selectExportLaunchError);
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
            <ExportResolution cropResolution={cropResolution} settings={settings} />
            <ExportFrameRate settings={settings} />
          </div>

          <CommandPreview command={commandPreview} error={commandPreviewError?.message} />

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("export.dialogs.optimized.saveNotice")}
            </p>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={() => onOpenChange(false)} variant="outline">
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={() => void dispatch(startOptimizedExportRequested())}>
                {t("export.actions.start")}
              </Button>
            </div>
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
