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

function PreviewTransformResetDialogContent({
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
          {t("preview.transform.resetConfirmation.title")}
        </AlertDialogTitle>
        <AlertDialogDescription __scopeAlertDialog={__scopeAlertDialog}>
          {t("preview.transform.resetConfirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel __scopeAlertDialog={__scopeAlertDialog}>
          {t("common.actions.cancel")}
        </AlertDialogCancel>
        <AlertDialogAction
          __scopeAlertDialog={__scopeAlertDialog}
          onClick={onConfirm}
          variant="destructive"
        >
          {t("common.actions.resetToDefault")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { PreviewTransformResetDialogContent };
