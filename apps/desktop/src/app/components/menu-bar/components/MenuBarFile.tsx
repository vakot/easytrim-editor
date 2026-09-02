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
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveEditingInstanceRequested,
} from "@/app/store/thunks/source-media-thunks";
import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "@/features/source";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

export function MenuBarFile() {
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const activeItemId = useAppSelector(selectActiveInstanceId);

  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const cropApplied = useAppSelector(selectCropApplied);
  const canSave = canExport && !cropApplied;

  useKeyboardShortcut(
    (event) =>
      event.code === "KeyD" &&
      event.ctrlKey &&
      hasSource &&
      !isChoosingSource &&
      !isNativeDialogOpen,
    () => setDeleteDialogOpen(true),
  );
  useKeyboardShortcut(
    (event) => event.code === "KeyO" && event.ctrlKey && !isChoosingSource && !isNativeDialogOpen,
    () => void dispatch(chooseSourceRequested({ id: "Ctrl+O", type: "hotkey" })),
  );
  useKeyboardShortcut(
    (event) =>
      event.code === "KeyQ" &&
      event.ctrlKey &&
      hasSource &&
      !isChoosingSource &&
      !isNativeDialogOpen,
    () => void dispatch(closeActiveEditingInstanceRequested({ id: "Ctrl+Q", type: "hotkey" })),
  );
  useKeyboardShortcut(
    (event) => event.code === "KeyS" && event.ctrlKey && canSave,
    () => void dispatch(startFastCutRequested({ id: "Ctrl+S", type: "hotkey" })),
  );
  useKeyboardShortcut(
    (event) => event.code === "KeyE" && event.ctrlKey && canExport,
    () => void dispatch(openOptimizedExportDialog({ id: "Ctrl+E", type: "hotkey" })),
  );

  return (
    <DeleteSourceDialog
      onOpenChange={setDeleteDialogOpen}
      open={deleteDialogOpen}
      sourceId={activeItemId}
    >
      <MenubarMenu value="file">
        <MenubarTrigger asChild>
          <Button className="text-foreground/80" size="xs" type="button" variant="ghost">
            {t("app.labels.file")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              disabled={isChoosingSource || isNativeDialogOpen}
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
              disabled={isChoosingSource || isNativeDialogOpen}
              onSelect={() =>
                void dispatch(
                  chooseSourceRequested({ id: "file.open-folder", type: "menu" }, "folders"),
                )
              }
            >
              {t("app.actions.openFolder")}
            </MenubarItem>
            <MenubarItem
              disabled={!hasSource}
              onSelect={() =>
                void dispatch(closeActiveEditingInstanceRequested({ id: "file.close", type: "menu" }))
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
            <DeleteSourceDialogTrigger asChild>
              <MenubarItem
                disabled={!hasSource}
                onSelect={(event) => event.preventDefault()}
                variant="destructive"
              >
                {t("app.actions.deleteSource")}
                <MenubarShortcut>
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>D</Kbd>
                  </KbdGroup>
                </MenubarShortcut>
              </MenubarItem>
            </DeleteSourceDialogTrigger>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </DeleteSourceDialog>
  );
}
