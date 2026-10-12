import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { clearWorkspaceRecoveryOnAcceptedShutdown } from "@/app/store/recovery/workspace-recovery";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectHasProcessableExports } from "@/app/store/slices/editing-instances-slice";
import { lazyWithPreload } from "@/lib/lazy-component";
import {
  closeWindow,
  listenForWindowCloseRequests,
  listenForWindowShutdownRequests,
  type WindowShutdownContinuation,
} from "@/lib/tauri/window";

const LazyAppShutdownGuardContent = lazyWithPreload<{
  onConfirmClose: () => void;
}>(() =>
  import("./AppShutdownGuardContent").then((module) => ({
    default: module.AppShutdownGuardContent,
  })),
);

function AppShutdownGuard() {
  const hasProcessableExports = useAppSelector(selectHasProcessableExports);
  const [open, setOpen] = useState(false);
  const allowClose = useRef(false);
  const pendingContinuation = useRef<WindowShutdownContinuation | null>(null);

  const openShutdownConfirmation = useCallback(() => {
    void LazyAppShutdownGuardContent.preload().then(
      () => setOpen(true),
      () => setOpen(true),
    );
  }, []);

  const acceptClose = useCallback(async () => {
    await clearWorkspaceRecoveryOnAcceptedShutdown();
    allowClose.current = true;
    try {
      await closeWindow();
    } catch {
      allowClose.current = false;
      openShutdownConfirmation();
    }
  }, [openShutdownConfirmation]);

  const handleShutdownRequest = useCallback(
    (continuation?: WindowShutdownContinuation) => {
      if (hasProcessableExports) {
        pendingContinuation.current = continuation ?? null;
        openShutdownConfirmation();
        return;
      }

      if (continuation) {
        void clearWorkspaceRecoveryOnAcceptedShutdown()
          .then(continuation)
          .catch(openShutdownConfirmation);
      } else {
        void acceptClose();
      }
    },
    [acceptClose, hasProcessableExports, openShutdownConfirmation],
  );

  useEffect(() => {
    const unlistenPromise = listenForWindowCloseRequests(
      () => {
        if (allowClose.current) {
          allowClose.current = false;
          return false;
        }
        return true;
      },
      () => {
        if (hasProcessableExports) openShutdownConfirmation();
        else void acceptClose();
      },
    );

    const unlistenShutdown = listenForWindowShutdownRequests(handleShutdownRequest);

    return () => {
      unlistenShutdown();
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [acceptClose, handleShutdownRequest, hasProcessableExports, openShutdownConfirmation]);

  const confirmClose = () => {
    const continuation = pendingContinuation.current;
    pendingContinuation.current = null;

    if (continuation) {
      setOpen(false);
      void clearWorkspaceRecoveryOnAcceptedShutdown()
        .then(continuation)
        .catch(openShutdownConfirmation);
      return;
    }

    setOpen(false);
    void acceptClose();
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogContent>
        <Suspense fallback={null}>
          <LazyAppShutdownGuardContent onConfirmClose={confirmClose} />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AppShutdownGuard };
