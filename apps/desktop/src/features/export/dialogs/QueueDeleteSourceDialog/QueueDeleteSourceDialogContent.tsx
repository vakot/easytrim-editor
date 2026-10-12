import { useTranslation } from "react-i18next";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function QueueDeleteSourceDialogContent({
  __scopeAlertDialog,
  onConfirm,
}: {
  __scopeAlertDialog?: AlertDialogScope;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle __scopeAlertDialog={__scopeAlertDialog}>
          {t("queue.deleteSource.confirmation.title")}
        </AlertDialogTitle>
        <AlertDialogDescription __scopeAlertDialog={__scopeAlertDialog}>
          {t("queue.deleteSource.confirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel __scopeAlertDialog={__scopeAlertDialog}>
          {t("common.actions.back")}
        </AlertDialogCancel>
        <AlertDialogAction
          __scopeAlertDialog={__scopeAlertDialog}
          onClick={onConfirm}
          variant="destructive"
        >
          {t("queue.deleteSource.enable")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { QueueDeleteSourceDialogContent };
