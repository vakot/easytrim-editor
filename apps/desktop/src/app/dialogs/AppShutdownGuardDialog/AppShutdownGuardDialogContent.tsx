import { useTranslation } from "react-i18next";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function AppShutdownGuardDialogContent({ onConfirmClose }: { onConfirmClose: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("app.shutdown.confirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("app.shutdown.confirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.actions.back")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirmClose} variant="destructive">
          {t("queue.onFinished.shortOptions.exit")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { AppShutdownGuardDialogContent };
