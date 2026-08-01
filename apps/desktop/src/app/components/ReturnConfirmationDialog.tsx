import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

interface ReturnConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReturnConfirmationDialog({
  open,
  onCancel,
  onConfirm,
}: ReturnConfirmationDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
            {t("app.returnDialog.eyebrow")}
          </p>
          <DialogTitle>{t("app.returnDialog.title")}</DialogTitle>
          <DialogDescription>{t("app.returnDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("app.returnDialog.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
