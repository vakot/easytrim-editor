import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteSourceDialogProps {
  error?: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending?: boolean;
  sourceName: string;
}

export function DeleteSourceDialog({
  error,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  sourceName,
}: DeleteSourceDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("source.dialogs.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("source.dialogs.delete.description", { name: sourceName })}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button disabled={pending} onClick={() => onOpenChange(false)} variant="outline">
            {t("common.actions.cancel")}
          </Button>
          <Button disabled={pending} onClick={onConfirm} variant="destructive">
            {t("common.actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
