import { useTranslation } from "react-i18next";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { clearWorkspaceRecoveryOnAcceptedShutdown } from "@/app/store/recovery/workspace-recovery";
import { closeWindow, type WindowShutdownContinuation } from "@/lib/tauri/window";

function AppShutdownGuardDialogContent({
  continuation,
}: {
  continuation?: WindowShutdownContinuation;
}) {
  const { t } = useTranslation();

  const handleAccept = async () => {
    // TODO: simple allow shutdown
    try {
      await clearWorkspaceRecoveryOnAcceptedShutdown();

      if (continuation) {
        continuation?.();
        return;
      }

      await closeWindow();
    } catch {
      handleReject();
    }
  };

  const handleReject = async () => {
    // TODO: simple reject shutdown
    return;
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("app.shutdown.confirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("app.shutdown.confirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={handleReject}>{t("common.actions.back")}</AlertDialogCancel>
        <AlertDialogAction onClick={handleAccept} variant="destructive">
          {t("queue.onFinished.shortOptions.exit")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { AppShutdownGuardDialogContent };
