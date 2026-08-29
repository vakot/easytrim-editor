import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import { selectIsChoosingSource } from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";

export function MenuBarFile() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const cropApplied = useAppSelector(selectCropApplied);
  const canSave = canExport && !cropApplied;

  return (
    <MenubarMenu value="file">
      <MenubarTrigger asChild>
        <Button
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("app.labels.file")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <MenubarItem
            disabled={isChoosingSource}
            onSelect={() => void dispatch(chooseSourceRequested())}
            suffix="Ctrl+O"
          >
            {t("app.actions.openFile")}
          </MenubarItem>
          <MenubarItem
            disabled={!hasSource}
            onSelect={() => void dispatch(closeActiveImportedItemRequested())}
            suffix="Ctrl+Q"
          >
            {t("app.actions.closeFile")}
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem
            disabled={!canSave}
            onSelect={() => void dispatch(startFastCutRequested())}
            suffix="Ctrl+S"
          >
            {t("export.actions.fast")}
          </MenubarItem>
          <MenubarItem
            disabled={!canExport}
            onSelect={() => void dispatch(openOptimizedExportDialog())}
            suffix="Ctrl+E"
          >
            {t("export.actions.optimized")}
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
