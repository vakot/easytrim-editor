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
import {
  closeWindow,
  listenForWindowCloseRequests,
  listenForWindowShutdownRequests,
  type WindowShutdownContinuation,
} from "@/lib/tauri/window";

export function AppShutdownGuard() {
  const { t } = useTranslation();
  const hasProcessableExports = useAppSelector(selectHasProcessableExports);
  const [open, setOpen] = useState(false);
  const allowClose = useRef(false);
  const pendingContinuation = useRef<WindowShutdownContinuation | null>(null);

  const handleShutdownRequest = useCallback(
    (continuation?: WindowShutdownContinuation) => {
      if (hasProcessableExports) {
        pendingContinuation.current = continuation ?? null;
        setOpen(true);
        return;
      }

      void (continuation?.() ?? closeWindow());
    },
    [hasProcessableExports],
  );

  useEffect(() => {
    const unlistenPromise = listenForWindowCloseRequests(
      () => {
        if (allowClose.current) {
          allowClose.current = false;
          return false;
        }
        return hasProcessableExports;
      },
      () => setOpen(true),
    );

    const unlistenShutdown = listenForWindowShutdownRequests(handleShutdownRequest);

    return () => {
      unlistenShutdown();
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleShutdownRequest, hasProcessableExports]);

  const confirmClose = () => {
    const continuation = pendingContinuation.current;
    pendingContinuation.current = null;

    if (continuation) {
      setOpen(false);
      void Promise.resolve(continuation()).catch(() => setOpen(true));
      return;
    }

    allowClose.current = true;
    setOpen(false);
    void closeWindow().catch(() => {
      allowClose.current = false;
      setOpen(true);
    });
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
