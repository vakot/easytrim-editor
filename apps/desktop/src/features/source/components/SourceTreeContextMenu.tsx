import { type PropsWithChildren, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstanceById } from "@/app/store/slices/editing-instances-slice";
import {
  closeEditingInstancesRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { openFileLocation } from "@/lib/tauri/media";

import {
  getRevealLabel,
  getSourceAction,
  getSourceTreeRevealTargets,
  type SourceTreeRevealTarget,
} from "../lib/source-tree.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./DeleteSourceDialog";

export function SourceTreeContextMenu({
  children,
  kind,
  revealPath,
  sourceIds,
}: PropsWithChildren<{
  kind: "file" | "folder";
  revealPath: string;
  sourceIds: string[];
}>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const targetInstances = useAppSelector(
    (state) =>
      sourceIds
        .map((sourceId) => selectEditingInstanceById(state, sourceId))
        .filter((instance): instance is EditingInstance => Boolean(instance)),
    shallowEqual,
  );

  const sourceAction = getSourceAction(targetInstances);
  const revealTargets =
    kind === "file"
      ? getSourceTreeRevealTargets(targetInstances[0])
      : ([] as SourceTreeRevealTarget[]);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const closeSources = () => {
    if (kind === "folder") {
      setCloseDialogOpen(true);
      return;
    }
    void dispatch(closeEditingInstancesRequested(sourceIds));
  };

  const confirmCloseSources = () => {
    setCloseDialogOpen(false);
    void dispatch(closeEditingInstancesRequested(sourceIds));
  };

  const revealFile = (path: string) => {
    void openFileLocation(path).catch(() => undefined);
  };

  const revealSource = () => {
    revealFile(revealPath);
  };

  const restoreSources = () => {
    const sourcesByPath = new Map<string, string>();
    for (const instance of targetInstances) {
      if (instance.sourceAvailability === "deleted") {
        sourcesByPath.set(instance.snapshot.source.sourcePath, instance.id);
      }
    }
    for (const [sourcePath, itemId] of sourcesByPath) {
      void dispatch(restoreSourceFileRequested({ itemId, sourcePath }));
    }
  };

  return (
    <>
      <DeleteSourceDialog sourceIds={sourceIds}>
        <ContextMenu>
          <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              {kind === "file" ? (
                <ContextMenuItem
                  onSelect={() => {
                    const sourceId = sourceIds[0];
                    if (sourceId) void dispatch(navigateToEditingInstance(sourceId));
                  }}
                >
                  {t("app.actions.open")}
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem onSelect={closeSources}>{t("common.actions.close")}</ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              {revealTargets.length > 0 ? (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>{getRevealLabel(t)}</ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    <ContextMenuItem
                      disabled={targetInstances[0]?.sourceAvailability === "deleted"}
                      onSelect={revealSource}
                    >
                      {t("source.labels.title")}
                    </ContextMenuItem>
                    {revealTargets.map((target, index) => (
                      <ContextMenuItem
                        key={`${target.path}:${index}`}
                        onSelect={() => revealFile(target.path)}
                      >
                        {target.displayName}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              ) : (
                <ContextMenuItem disabled={sourceAction === "restore"} onSelect={revealSource}>
                  {getRevealLabel(t)}
                </ContextMenuItem>
              )}
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              {sourceAction === "restore" ? (
                <ContextMenuItem onSelect={restoreSources} variant="success">
                  {t("app.actions.restore")}
                </ContextMenuItem>
              ) : (
                <DeleteSourceDialogTrigger asChild>
                  <ContextMenuItem
                    onSelect={(event) => event.preventDefault()}
                    variant="destructive"
                  >
                    {t("common.actions.delete")}
                  </ContextMenuItem>
                </DeleteSourceDialogTrigger>
              )}
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      </DeleteSourceDialog>
      <AlertDialog onOpenChange={setCloseDialogOpen} open={closeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("source.dialogs.closeFolder.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("source.dialogs.closeFolder.description", { count: sourceIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseSources} variant="destructive">
              {t("common.actions.close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
