import { useTranslation } from "react-i18next";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function PreviewTransformResetDialogContent({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("preview.transform.resetConfirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("preview.transform.resetConfirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} variant="destructive">
          {t("common.actions.resetToDefault")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { PreviewTransformResetDialogContent };
