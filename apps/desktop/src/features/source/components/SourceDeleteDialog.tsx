import { type ReactNode, useState } from "react";
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
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { deleteActiveEditingInstanceSourceRequested } from "@/app/store/thunks/source-media-thunks";
import { normalizeSourceKey } from "@/domain/source";

interface SourceDeleteDialogProps {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  sourceId?: string | null;
  sourceIds?: string[];
  target?: "file" | "folder";
  targetName?: string;
}

function SourceDeleteDialog({
  children,
  onOpenChange,
  open,
  sourceId,
  sourceIds,
  target = "file",
  targetName,
}: SourceDeleteDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const targetIds = sourceIds?.length ? sourceIds : sourceId ? [sourceId] : [];
  const targetIdSet = new Set(targetIds);
  const items = instances.filter((instance) => targetIdSet.has(instance.id));
  const item = items[0];
  const isFolder = target === "folder";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteSource = async () => {
    if (items.length === 0) return;
    setPending(true);
    setError(null);
    const sourceIdsByPath = new Map<string, string>();
    for (const item of items) {
      if (item.sourceAvailability !== "deleted") {
        sourceIdsByPath.set(normalizeSourceKey(item.snapshot.source.sourcePath), item.id);
      }
    }

    let firstError: string | null = null;
    for (const id of sourceIdsByPath.values()) {
      const result = await dispatch(deleteActiveEditingInstanceSourceRequested(id));
      if (result && !firstError) firstError = result.message;
    }
    if (firstError) setError(firstError);
    setPending(false);
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      {children}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isFolder ? t("source.dialogs.delete.folderTitle") : t("source.dialogs.delete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isFolder
              ? t("source.dialogs.delete.folderDescription", { name: targetName })
              : t("source.dialogs.delete.description", {
                  name:
                    items.length > 1
                      ? `${item?.snapshot.source.displayName} and ${items.length - 1} more sources`
                      : item?.snapshot.source.displayName,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("common.actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || items.length === 0}
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

export { SourceDeleteDialog, AlertDialogTrigger as SourceDeleteDialogTrigger };
