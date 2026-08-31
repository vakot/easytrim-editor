import { useState } from "react";
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

import { normalizeAppError } from "@/lib/tauri/media.utils";

import { useImportQueue } from "../hooks/useImportQueue";

interface DeleteSourceDialogProps {
  children: React.ReactNode;
  sourceId: string | null | undefined;
}

export function DeleteSourceDialog({ children, sourceId }: DeleteSourceDialogProps) {
  const { t } = useTranslation();

  const { deleteSource, items } = useImportQueue();

  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteItem = items.find((item) => item.id === sourceId);

  const filename = deleteItem?.snapshot.source.displayName;

  const handleDeleteSource = async () => {
    if (!sourceId) return;

    const item = items.find((candidate) => candidate.id === sourceId);
    if (!item) return;

    setDeletePending(true);
    setDeleteError(null);

    try {
      await deleteSource(sourceId);
    } catch (error: unknown) {
      setDeleteError(normalizeAppError(error).message);
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <AlertDialog>
      {children}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("source.dialogs.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("source.dialogs.delete.description", { name: filename })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePending}>
            {t("common.actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deletePending}
            onClick={handleDeleteSource}
            variant="destructive"
          >
            {t("common.actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AlertDialogTrigger as DeleteSourceDialogTrigger };
