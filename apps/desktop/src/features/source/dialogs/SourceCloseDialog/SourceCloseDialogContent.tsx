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

interface SourceCloseDialogContentProps {
  __scopeAlertDialog?: AlertDialogScope;
  onConfirm: () => void;
  sourceCount: number;
}

function SourceCloseDialogContent({
  __scopeAlertDialog,
  onConfirm,
  sourceCount,
}: SourceCloseDialogContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle __scopeAlertDialog={__scopeAlertDialog}>
          {t("source.close.confirmation.title")}
        </AlertDialogTitle>
        <AlertDialogDescription __scopeAlertDialog={__scopeAlertDialog}>
          {t("source.close.confirmation.description", { count: sourceCount })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel __scopeAlertDialog={__scopeAlertDialog}>
          {t("common.actions.cancel")}
        </AlertDialogCancel>
        <AlertDialogAction __scopeAlertDialog={__scopeAlertDialog} onClick={onConfirm} variant="destructive">
          {t("common.actions.close")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { SourceCloseDialogContent };
export type { SourceCloseDialogContentProps };
