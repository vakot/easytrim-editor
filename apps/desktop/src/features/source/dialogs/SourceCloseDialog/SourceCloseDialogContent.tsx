import { useTranslation } from "react-i18next";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SourceCloseDialogContentProps {
  onConfirm: () => void;
  sourceCount: number;
}

function SourceCloseDialogContent({ onConfirm, sourceCount }: SourceCloseDialogContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("source.close.confirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("source.close.confirmation.description", { count: sourceCount })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} variant="destructive">
          {t("common.actions.close")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { SourceCloseDialogContent };
export type { SourceCloseDialogContentProps };
