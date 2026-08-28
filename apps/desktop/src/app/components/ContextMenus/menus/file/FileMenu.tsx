import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import { selectIsChoosingSource } from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";

import type { MenuNavigation } from "../../types";

export function FileMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const cropApplied = useAppSelector(selectCropApplied);
  const canSave = canExport && !cropApplied;

  return (
    <Menu modal={false} open={navigation.open} onOpenChange={navigation.onOpenChange}>
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          {t("app.topBarMenus.file")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          disabled={isChoosingSource}
          suffix="Ctrl+O"
          onSelect={() => void dispatch(chooseSourceRequested())}
        >
          {t("app.topBarMenus.openFile")}
        </MenuItem>
        <MenuItem
          disabled={!hasSource}
          suffix="Ctrl+Q"
          onSelect={() => void dispatch(closeActiveImportedItemRequested())}
        >
          {t("app.topBarMenus.closeFile")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={!canSave}
          suffix="Ctrl+S"
          onSelect={() => void dispatch(startFastCutRequested())}
        >
          {t("app.topBarMenus.saveLosslessCut")}
        </MenuItem>
        <MenuItem
          disabled={!canExport}
          suffix="Ctrl+E"
          onSelect={() => void dispatch(openOptimizedExportDialog())}
        >
          {t("app.topBarMenus.optimizeExport")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
