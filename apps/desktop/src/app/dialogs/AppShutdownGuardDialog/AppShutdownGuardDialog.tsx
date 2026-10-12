import { Suspense, useCallback, useEffect, useState } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectHasProcessableExports } from "@/app/store/slices/editing-instances-slice";
import { lazyWithPreload } from "@/lib/lazy-component";
import {
  listenForWindowCloseRequests,
  listenForWindowShutdownRequests,
  type WindowShutdownContinuation,
} from "@/lib/tauri/window";

const LazyAppShutdownGuardDialogContent = lazyWithPreload<{
  continuation?: WindowShutdownContinuation;
}>(() =>
  import("./AppShutdownGuardDialogContent").then((module) => ({
    default: module.AppShutdownGuardDialogContent,
  })),
);

function AppShutdownGuardDialog() {
  const hasProcessableExports = useAppSelector(selectHasProcessableExports);
  const [open, setOpen] = useState(false);
  const [pendingContinuation, setPendingContinuation] = useState<WindowShutdownContinuation>();

  const handleCloseRequest = useCallback((continuation?: WindowShutdownContinuation) => {
    setPendingContinuation(continuation);
    setOpen(true);
  }, []);

  const handleCloseRejected = useCallback(() => {
    setPendingContinuation(undefined);
    setOpen(false);
  }, []);

  useEffect(() => {
    // TODO: only open dialog when hasProcessableExports
    const unlistenPromise = listenForWindowCloseRequests(() => false, handleCloseRequest); // TODO: reset to close on reject - handleCloseRejected
    const unlistenShutdown = listenForWindowShutdownRequests(handleCloseRequest); // TODO: reset to close on reject - handleCloseRejected

    return () => {
      unlistenShutdown();
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [hasProcessableExports, handleCloseRequest]);

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogContent>
        <Suspense fallback={null}>
          <LazyAppShutdownGuardDialogContent continuation={pendingContinuation} />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AppShutdownGuardDialog };
