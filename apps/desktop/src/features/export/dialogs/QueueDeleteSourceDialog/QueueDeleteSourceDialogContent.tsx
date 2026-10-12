import { useTranslation } from "react-i18next";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function QueueDeleteSourceDialogContent({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("queue.deleteSource.confirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("queue.deleteSource.confirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.actions.back")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} variant="destructive">
          {t("queue.deleteSource.enable")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { QueueDeleteSourceDialogContent };
