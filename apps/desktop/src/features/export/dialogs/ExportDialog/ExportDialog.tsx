import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportDialogOpen, selectExportLaunchError } from "@/app/store/slices/export-slice";
import {
  cancelOptimizedExportDialogRequested,
  openOptimizedExportDialog,
} from "@/app/store/thunks/export-thunks";
import { localizeAppError } from "@/i18n/app-errors";
import { lazyWithPreload } from "@/lib/lazy-component";

import type { ExportDialogContentProps } from "./ExportDialogContent";

const LazyExportDialogContent = lazyWithPreload<ExportDialogContentProps>(() =>
  import("./ExportDialogContent").then((module) => ({
    default: module.ExportDialogContent,
  })),
);

const ExportDialog = Object.assign(
  function ExportDialog() {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const open = useAppSelector(selectExportDialogOpen);
    const launchError = useAppSelector(selectExportLaunchError);

    function handleOpenChange(nextOpen: boolean) {
      if (nextOpen) {
        void dispatch(openOptimizedExportDialog());
      } else {
        dispatch(cancelOptimizedExportDialogRequested());
      }
    }

    return (
      <>
        <Dialog onOpenChange={handleOpenChange} open={open}>
          <DialogContent className="sm:max-w-xl">
            <Suspense fallback={null}>
              <LazyExportDialogContent onCancel={() => handleOpenChange(false)} />
            </Suspense>
          </DialogContent>
        </Dialog>

        {launchError ? (
          <Alert className="absolute top-full right-5 z-40 mt-2 w-80" variant="destructive">
            <AlertDescription>{localizeAppError(launchError, t)}</AlertDescription>
          </Alert>
        ) : null}
      </>
    );
  },
  { preload: () => LazyExportDialogContent.preload() },
);

export { ExportDialog };
