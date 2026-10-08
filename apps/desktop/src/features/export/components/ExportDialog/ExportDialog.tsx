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
  selectExportCommandPreview,
  selectExportCommandPreviewError,
  selectExportDialogRoute,
  selectExportLaunchError,
  selectOptimizedExportDialogOpen,
  selectQueueEdit,
} from "@/app/store/slices/export-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import {
  cancelOptimizedExportDialogRequested,
  openOptimizedExportDialog,
  refreshOptimizedExportPlan,
  startGifExportRequested,
  startOptimizedExportRequested,
} from "@/app/store/thunks/export-thunks";
import { localizeAppError } from "@/i18n/app-errors";

import { CommandPreview } from "./components/CommandPreview";
import { ExportFrameRate } from "./components/ExportFrameRate";
import { ExportResolution } from "./components/ExportResolution";
import { PresetManager } from "./components/PresetManager";

function ExportDialog() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectOptimizedExportDialogOpen);
  const queueEdit = useAppSelector(selectQueueEdit);
  const dialogRoute = useAppSelector(selectExportDialogRoute);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const source = useAppSelector(selectSourceMedia);
  const cropResolution = useAppSelector(selectCropResolution);
  const settings = activeInstance
    ? (activeInstance.optimizedSettings ?? {
        frameRate: undefined,
        resolution: cropResolution,
      })
    : null;

  const argumentsText = useAppSelector(selectExportArguments);
  const commandPreview = useAppSelector(selectExportCommandPreview);
  const commandPreviewError = useAppSelector(selectExportCommandPreviewError);
  const launchError = useAppSelector(selectExportLaunchError);
  const previousArgumentsText = useRef(argumentsText);

  useEffect(() => {
    if (previousArgumentsText.current === argumentsText) return;
    previousArgumentsText.current = argumentsText;
    if (open && dialogRoute === "optimized") void dispatch(refreshOptimizedExportPlan());
  }, [argumentsText, dispatch, dialogRoute, open]);

  if (!source || !settings) return null;

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      void dispatch(openOptimizedExportDialog());
    } else {
      dispatch(cancelOptimizedExportDialogRequested());
    }
  };

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {queueEdit
                ? t("export.optimized.dialog.editTitle")
                : dialogRoute === "gif"
                  ? t("export.gif.dialog.title")
                  : t("export.actions.start")}
            </DialogTitle>
            <DialogDescription>
              {dialogRoute === "gif"
                ? t("export.gif.dialog.description")
                : t("export.optimized.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          {dialogRoute === "optimized" ? <PresetManager /> : null}
          <ExportResolution cropResolution={cropResolution} settings={settings} />
          <ExportFrameRate settings={settings} />
          {dialogRoute === "optimized" ? (
            <CommandPreview
              command={commandPreview}
              error={commandPreviewError ? localizeAppError(commandPreviewError, t) : undefined}
            />
          ) : null}

          <DialogFooter className="min-w-0 items-center sm:justify-between">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {t("export.optimized.dialog.saveNotice")}
            </p>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={() => onOpenChange(false)} variant="outline">
                {t("common.actions.cancel")}
              </Button>
              <Button
                onClick={() =>
                  void dispatch(
                    dialogRoute === "gif"
                      ? startGifExportRequested()
                      : startOptimizedExportRequested(),
                  )
                }
              >
                {queueEdit
                  ? t("export.actions.saveChanges")
                  : dialogRoute === "gif"
                    ? t("export.gif.action")
                    : t("export.actions.start")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {launchError ? (
        <Alert className="absolute top-full right-5 z-40 mt-2 w-80" variant="destructive">
          <AlertDescription>{localizeAppError(launchError, t)}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export { ExportDialog };
