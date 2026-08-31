import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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

import { restoreSourceFromTrash } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

import { useImportQueue } from "../hooks/useImportQueue";
import { formatSourcePath } from "../lib/media-formatters.utils";

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

    const filename = item.snapshot.source.displayName;
    const sourcePath = item.snapshot.source.sourcePath;
    const normalizedSourcePath = formatSourcePath(sourcePath);

    setDeletePending(true);
    setDeleteError(null);

    let restorePending = false;
    const deleteToastId = `import-delete-${sourceId}-${Date.now()}`;

    const restore = async () => {
      if (restorePending) return;

      restorePending = true;
      toast.loading(t("queue.messages.fileRestore.loading", { filename }), {
        action: null,
        description: <ToastFilePath sourcePath={normalizedSourcePath} />,
        id: deleteToastId,
      });

      try {
        await restoreSourceFromTrash(sourcePath);
        toast.success(t("queue.messages.fileRestore.success"), {
          action: null,
          description: <ToastFilePath sourcePath={normalizedSourcePath} />,
          id: deleteToastId,
        });
      } catch (error: unknown) {
        const normalized = normalizeAppError(error);
        toast.error(
          t("queue.messages.fileRestore.error", {
            filename,
            message: normalized.message,
          }),
          {
            action: {
              label: t("app.actions.restore"),
              onClick: (event) => {
                event.preventDefault();
                void restore();
              },
            },
            description: <ToastFilePath sourcePath={normalizedSourcePath} />,
            id: deleteToastId,
          },
        );
      } finally {
        restorePending = false;
      }
    };

    const deleteOperation = deleteSource(sourceId).then((error) => {
      if (error) throw error;
    });

    toast.promise(deleteOperation, {
      description: <ToastFilePath sourcePath={normalizedSourcePath} />,
      error: (error: unknown) => {
        const normalized = normalizeAppError(error);
        return t("queue.messages.fileDelete.error", {
          filename,
          message: normalized.message,
        });
      },
      loading: t("queue.messages.fileDelete.loading", { filename }),
      success: () => ({
        action: {
          label: t("app.actions.restore"),
          onClick: (event) => {
            event.preventDefault();
            void restore();
          },
        },
        description: <ToastFilePath sourcePath={normalizedSourcePath} />,
        message: t("queue.messages.fileDelete.success"),
      }),
      id: deleteToastId,
    });

    try {
      await deleteOperation;
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
            onClick={(event) => {
              event.preventDefault();
              handleDeleteSource();
            }}
            variant="destructive"
          >
            {t("common.actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ToastFilePath({ sourcePath }: { sourcePath: string }) {
  const normalizedSourcePath = formatSourcePath(sourcePath);
  return (
    <span className="block max-w-full truncate" dir="rtl" title={normalizedSourcePath}>
      {normalizedSourcePath}
    </span>
  );
}

export { AlertDialogTrigger as DeleteSourceDialogTrigger };
