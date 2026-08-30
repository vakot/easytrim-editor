import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import {
  selectHasSource,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
  deleteActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";
import { DeleteSourceDialog } from "@/features/source";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

export function MenuBarFile() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const cropApplied = useAppSelector(selectCropApplied);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const canSave = canExport && !cropApplied;

  const openDeleteDialog = () => {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  useKeyboardShortcut(
    (event) =>
      event.code === "KeyD" &&
      event.ctrlKey &&
      hasSource &&
      !isChoosingSource &&
      !isNativeDialogOpen,
    openDeleteDialog,
  );

  const handleDeleteSource = async () => {
    setDeletePending(true);
    setDeleteError(null);
    const error = await dispatch(deleteActiveImportedItemRequested());
    setDeletePending(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <MenubarMenu value="file">
        <MenubarTrigger asChild>
          <Button className="text-foreground/80" size="xs" type="button" variant="ghost">
            {t("app.labels.file")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              disabled={isChoosingSource}
              onSelect={() =>
                void dispatch(chooseSourceRequested({ id: "file.open", type: "menu" }))
              }
            >
              {t("app.actions.openFile")}
              <MenubarShortcut>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>O</Kbd>
                </KbdGroup>
              </MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!hasSource}
              onSelect={() =>
                void dispatch(closeActiveImportedItemRequested({ id: "file.close", type: "menu" }))
              }
            >
              {t("app.actions.closeFile")}
              <MenubarShortcut>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>Q</Kbd>
                </KbdGroup>
              </MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem
              disabled={!canSave}
              onSelect={() =>
                void dispatch(startFastCutRequested({ id: "file.fast-export", type: "menu" }))
              }
            >
              {t("export.actions.fast")}
              <MenubarShortcut>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>S</Kbd>
                </KbdGroup>
              </MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!canExport}
              onSelect={() =>
                void dispatch(
                  openOptimizedExportDialog({ id: "file.optimized-export", type: "menu" }),
                )
              }
            >
              {t("export.actions.optimized")}
              <MenubarShortcut>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>E</Kbd>
                </KbdGroup>
              </MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem disabled={!hasSource} onSelect={openDeleteDialog} variant="destructive">
              {t("app.actions.deleteSource")}
              <MenubarShortcut>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>D</Kbd>
                </KbdGroup>
              </MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
      {sourceSelection ? (
        <DeleteSourceDialog
          error={deleteError}
          onConfirm={() => void handleDeleteSource()}
          onOpenChange={setDeleteDialogOpen}
          open={deleteDialogOpen}
          pending={deletePending}
          sourceName={sourceSelection.displayName}
        />
      ) : null}
    </>
  );
}
