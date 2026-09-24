import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectHasProcessableExports } from "@/app/store/slices/editing-instances-slice";
import { clearWorkspaceRecoveryOnAcceptedShutdown } from "@/app/store/recovery/workspace-recovery";
import {
  closeWindow,
  listenForWindowCloseRequests,
  listenForWindowShutdownRequests,
  type WindowShutdownContinuation,
} from "@/lib/tauri/window";

function AppShutdownGuard() {
  const { t } = useTranslation();
  const hasProcessableExports = useAppSelector(selectHasProcessableExports);
  const [open, setOpen] = useState(false);
  const allowClose = useRef(false);
  const pendingContinuation = useRef<WindowShutdownContinuation | null>(null);

  const acceptClose = useCallback(async () => {
    await clearWorkspaceRecoveryOnAcceptedShutdown();
    allowClose.current = true;
    try {
      await closeWindow();
    } catch {
      allowClose.current = false;
      setOpen(true);
    }
  }, []);

  const handleShutdownRequest = useCallback(
    (continuation?: WindowShutdownContinuation) => {
      if (hasProcessableExports) {
        pendingContinuation.current = continuation ?? null;
        setOpen(true);
        return;
      }

      if (continuation) {
        void clearWorkspaceRecoveryOnAcceptedShutdown()
          .then(continuation)
          .catch(() => setOpen(true));
      } else {
        void acceptClose();
      }
    },
    [acceptClose, hasProcessableExports],
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
        if (hasProcessableExports) setOpen(true);
        else void acceptClose();
      },
    );

    const unlistenShutdown = listenForWindowShutdownRequests(handleShutdownRequest);

    return () => {
      unlistenShutdown();
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [acceptClose, handleShutdownRequest, hasProcessableExports]);

  const confirmClose = () => {
    const continuation = pendingContinuation.current;
    pendingContinuation.current = null;

    if (continuation) {
      setOpen(false);
      void clearWorkspaceRecoveryOnAcceptedShutdown()
        .then(continuation)
        .catch(() => setOpen(true));
      return;
    }

    setOpen(false);
    void acceptClose();
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("app.dialogs.shutdown.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("app.dialogs.shutdown.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.actions.back")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmClose} variant="destructive">
            {t("queue.options.finish.exit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AppShutdownGuard };
