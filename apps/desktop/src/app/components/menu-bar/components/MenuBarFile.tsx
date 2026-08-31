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
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectIsChoosingSource } from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";
import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "@/features/source";

export function MenuBarFile() {
  const { t } = useTranslation();

  const activeItemId = useAppSelector(selectActiveItemId);

  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const cropApplied = useAppSelector(selectCropApplied);
  const canSave = canExport && !cropApplied;

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
            <DeleteSourceDialog sourceId={activeItemId}>
              <DeleteSourceDialogTrigger asChild>
                <MenubarItem
                  disabled={!hasSource}
                  onSelect={(event) => event.preventDefault()}
                  variant="destructive"
                >
                  {t("app.actions.deleteSource")}
                </MenubarItem>
              </DeleteSourceDialogTrigger>
            </DeleteSourceDialog>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </>
  );
}
