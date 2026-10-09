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
  selectExportDialogOpen,
  selectExportDialogRoute,
  selectExportLaunchError,
  selectQueueEdit,
} from "@/app/store/slices/export-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { gifSettingsWithDefaults } from "@/domain/gif-export";
import {
  cancelOptimizedExportDialogRequested,
  openOptimizedExportDialog,
  refreshExportPlan,
  startGifExportRequested,
  startOptimizedExportRequested,
} from "@/app/store/thunks/export-thunks";
import { localizeAppError } from "@/i18n/app-errors";

import { CommandPreview, ExportResolution, FrameRate } from "./components/common";
import { GifExportOptions } from "./components/gif";
import { VideoExportOptions } from "./components/video";

function ExportDialog() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectExportDialogOpen);
  const queueEdit = useAppSelector(selectQueueEdit);
  const dialogRoute = useAppSelector(selectExportDialogRoute);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const source = useAppSelector(selectSourceMedia);
  const cropResolution = useAppSelector(selectCropResolution);
  const routeSettings =
    dialogRoute === "gif" ? activeInstance?.gifSettings : activeInstance?.optimizedSettings;

  const routeSettingsWithDefaults = routeSettings ?? {
    frameRate: undefined,
    resolution: cropResolution,
  };
  const settings = activeInstance
    ? dialogRoute === "gif"
      ? gifSettingsWithDefaults(routeSettingsWithDefaults)
      : routeSettingsWithDefaults
    : null;

  const argumentsText = useAppSelector(selectExportArguments);
  const commandPreview = useAppSelector(selectExportCommandPreview);
  const commandPreviewError = useAppSelector(selectExportCommandPreviewError);
  const launchError = useAppSelector(selectExportLaunchError);
  const previousArgumentsText = useRef(argumentsText);

  useEffect(() => {
    if (previousArgumentsText.current === argumentsText) return;
    previousArgumentsText.current = argumentsText;
    if (open && dialogRoute === "optimized") void dispatch(refreshExportPlan());
  }, [argumentsText, dispatch, dialogRoute, open]);

  if (!source || !settings) return null;

  const isGifRoute = dialogRoute === "gif";
  const routeComposition = isGifRoute
    ? {
        description: t("export.gif.dialog.description"),
        options: <GifExportOptions />,
        primaryAction: startGifExportRequested,
        primaryLabel: t("export.gif.action"),
        title: t("export.gif.dialog.title"),
      }
    : {
        description: t("export.optimized.dialog.description"),
        options: <VideoExportOptions />,
        primaryAction: startOptimizedExportRequested,
        primaryLabel: t("export.actions.start"),
        title: t("export.actions.start"),
      };

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
              {queueEdit ? t("export.optimized.dialog.editTitle") : routeComposition.title}
            </DialogTitle>
            <DialogDescription>{routeComposition.description}</DialogDescription>
          </DialogHeader>

          {routeComposition.options}
          <ExportResolution cropResolution={cropResolution} settings={settings} />
          <FrameRate settings={settings} />
          <CommandPreview
            command={commandPreview}
            error={commandPreviewError ? localizeAppError(commandPreviewError, t) : undefined}
          />

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
                    queueEdit ? startOptimizedExportRequested() : routeComposition.primaryAction(),
                  )
                }
              >
                {queueEdit ? t("export.actions.saveChanges") : routeComposition.primaryLabel}
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
