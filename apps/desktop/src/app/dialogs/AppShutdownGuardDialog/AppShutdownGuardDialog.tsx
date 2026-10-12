import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectHasProcessableExports } from "@/app/store/slices/editing-instances-slice";
import { lazyWithPreload } from "@/lib/lazy-component";
import {
  completeShutdown,
  listenForWindowCloseRequests,
  listenForWindowShutdownRequests,
  type WindowShutdownContinuation,
} from "@/lib/tauri/window";

const loadDialog = () => import("./AppShutdownGuardDialogContent");

const useAppShutdownGuardDialogScope = createAlertDialogScope();

const LazyAppShutdownGuardDialogContent = lazyWithPreload<{
  __scopeAlertDialog?: AlertDialogScope;
  continuation?: WindowShutdownContinuation;
}>(() => loadDialog().then((module) => ({ default: module.AppShutdownGuardDialogContent })));

function AppShutdownGuardDialog({
  __scopeAlertDialog,
}: {
  __scopeAlertDialog?: AlertDialogScope;
}) {
  const alertDialogScope = useAppShutdownGuardDialogScope(__scopeAlertDialog);
  const { t } = useTranslation();
  const hasProcessableExports = useAppSelector(selectHasProcessableExports);
  const [open, setOpen] = useState(false);
  const [continuation, setContinuation] = useState<WindowShutdownContinuation>();

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setContinuation(undefined);
    }
  }, []);

  const handleShutdownRequest = useCallback(
    (continuation?: WindowShutdownContinuation) => {
      if (open) {
        if (continuation) setContinuation(() => continuation);
        return;
      }

      if (hasProcessableExports) {
        setContinuation(() => continuation);
        void LazyAppShutdownGuardDialogContent.preload().then(
          () => setOpen(true),
          () => setOpen(true),
        );
        return;
      }

      void completeShutdown(continuation).catch((error: unknown) => {
        console.error("Failed to shut down the application:", error);
        toast.error(t("app.shutdown.errors.failed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      });
    },
    [open, hasProcessableExports, t],
  );

  useEffect(() => {
    const unlistenPromise = listenForWindowCloseRequests(handleShutdownRequest);
    const unlistenShutdown = listenForWindowShutdownRequests(handleShutdownRequest);

    return () => {
      unlistenShutdown();
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleShutdownRequest]);

  return (
    <AlertDialog {...alertDialogScope} onOpenChange={handleOpenChange} open={open}>
      <AlertDialogContent {...alertDialogScope}>
        <Suspense fallback={null}>
          <LazyAppShutdownGuardDialogContent
            __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
            continuation={continuation}
          />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AppShutdownGuardDialog };
