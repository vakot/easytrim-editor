import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstanceById } from "@/app/store/slices/editing-instances-slice";
import { deleteActiveEditingInstanceSourceRequested } from "@/app/store/thunks/source-media-thunks";

interface DeleteSourceDialogProps {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  sourceId: string | null | undefined;
}

export function DeleteSourceDialog({ children, onOpenChange, open, sourceId }: DeleteSourceDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const item = useAppSelector((state) => (sourceId ? selectEditingInstanceById(state, sourceId) : undefined));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteSource = async () => {
    if (!sourceId) return;
    setPending(true);
    setError(null);
    const result = await dispatch(deleteActiveEditingInstanceSourceRequested(sourceId));
    if (result) setError(result.message);
    setPending(false);
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      {children}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("source.dialogs.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("source.dialogs.delete.description", { name: item?.snapshot.source.displayName })}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("common.actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={pending || !item} onClick={handleDeleteSource} variant="destructive">
            {t("common.actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AlertDialogTrigger as DeleteSourceDialogTrigger };
