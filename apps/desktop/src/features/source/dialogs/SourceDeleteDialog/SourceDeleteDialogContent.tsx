import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { deleteActiveEditingInstanceSourceRequested } from "@/app/store/thunks/source-media-thunks";
import type { AppError } from "@/domain/media";
import { normalizeSourceKey } from "@/domain/source";
import { localizeAppError } from "@/i18n/app-errors";

interface SourceDeleteDialogContentProps {
  __scopeAlertDialog?: AlertDialogScope;
  sourceIds: readonly string[];
  target?: "file" | "folder";
  targetName?: string;
}

function SourceDeleteDialogContent({
  __scopeAlertDialog,
  sourceIds,
  target = "file",
  targetName,
}: SourceDeleteDialogContentProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const targetIdSet = new Set(sourceIds);
  const items = instances.filter((instance) => targetIdSet.has(instance.id));
  const item = items[0];
  const isFolder = target === "folder";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

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

    let firstError: AppError | null = null;
    for (const id of sourceIdsByPath.values()) {
      const result = await dispatch(deleteActiveEditingInstanceSourceRequested(id));
      if (result && !firstError) firstError = result;
    }
    if (firstError) setError(firstError);
    setPending(false);
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle __scopeAlertDialog={__scopeAlertDialog}>
          {isFolder
            ? t("source.delete.confirmation.folderTitle")
            : t("source.delete.confirmation.title")}
        </AlertDialogTitle>
        <AlertDialogDescription __scopeAlertDialog={__scopeAlertDialog}>
          {isFolder
            ? t("source.delete.confirmation.folderDescription", { name: targetName })
            : t("source.delete.confirmation.description", {
                name:
                  items.length > 1
                    ? `${item?.snapshot.source.displayName} and ${items.length - 1} more sources`
                    : item?.snapshot.source.displayName,
              })}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{localizeAppError(error, t)}</AlertDescription>
        </Alert>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel __scopeAlertDialog={__scopeAlertDialog} disabled={pending}>
          {t("common.actions.cancel")}
        </AlertDialogCancel>
        <AlertDialogAction
          __scopeAlertDialog={__scopeAlertDialog}
          disabled={pending || items.length === 0}
          onClick={handleDeleteSource}
          variant="destructive"
        >
          {t("source.delete.action")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { SourceDeleteDialogContent };
export type { SourceDeleteDialogContentProps };
