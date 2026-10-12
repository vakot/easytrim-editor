import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

import { completeShutdown, type WindowShutdownContinuation } from "@/lib/tauri/window";

function AppShutdownGuardDialogContent({
  continuation,
}: {
  continuation?: WindowShutdownContinuation;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const handleConfirm = async () => {
    if (pending) return;

    setPending(true);
    setError(undefined);

    try {
      await completeShutdown(continuation);
    } catch (error) {
      console.error("Failed to shut down the application:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("app.shutdown.confirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("app.shutdown.confirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{t("common.actions.back")}</AlertDialogCancel>

        <AlertDialogAction
          disabled={pending}
          onClick={(event) => {
            event.preventDefault();
            void handleConfirm();
          }}
          variant="destructive"
        >
          {pending && <Spinner />}
          {t("queue.onFinished.shortOptions.exit")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { AppShutdownGuardDialogContent };
