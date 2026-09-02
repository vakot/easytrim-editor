import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import {
  closeActiveEditingInstanceRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import { openFileLocation } from "@/lib/tauri/media";

import { getRevealLabel, getSourceAction } from "../lib/source-tree.utils";

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
  const instances = useAppSelector(selectEditingInstances);
  const targetInstances = instances.filter((instance) => sourceIds.includes(instance.id));
  const sourceAction = getSourceAction(targetInstances);

  const closeSources = () => {
    for (const sourceId of sourceIds) {
      void dispatch(closeActiveEditingInstanceRequested(sourceId));
    }
  };

  const revealSource = () => {
    void openFileLocation(revealPath).catch(() => undefined);
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
            <ContextMenuItem disabled={sourceAction === "restore"} onSelect={revealSource}>
              {getRevealLabel(t)}
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            {sourceAction === "restore" ? (
              <ContextMenuItem onSelect={restoreSources} variant="success">
                {t("app.actions.restore")}
              </ContextMenuItem>
            ) : (
              <DeleteSourceDialogTrigger asChild>
                <ContextMenuItem onSelect={(event) => event.preventDefault()} variant="destructive">
                  {t("common.actions.delete")}
                </ContextMenuItem>
              </DeleteSourceDialogTrigger>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </DeleteSourceDialog>
  );
}
