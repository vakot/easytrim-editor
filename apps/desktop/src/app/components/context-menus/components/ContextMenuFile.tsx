import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import { selectIsChoosingSource } from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";

import type { MenuNavigation } from "../types";

export function ContextMenuFile({ navigation }: { navigation: MenuNavigation }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const cropApplied = useAppSelector(selectCropApplied);
  const canSave = canExport && !cropApplied;

  return (
    <Menu modal={false} onOpenChange={navigation.onOpenChange} open={navigation.open}>
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("app.topBarMenus.file")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuGroup>
          <MenuItem
            disabled={isChoosingSource}
            onSelect={() => void dispatch(chooseSourceRequested())}
            suffix="Ctrl+O"
          >
            {t("app.topBarMenus.openFile")}
          </MenuItem>
          <MenuItem
            disabled={!hasSource}
            onSelect={() => void dispatch(closeActiveImportedItemRequested())}
            suffix="Ctrl+Q"
          >
            {t("app.topBarMenus.closeFile")}
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem
            disabled={!canSave}
            onSelect={() => void dispatch(startFastCutRequested())}
            suffix="Ctrl+S"
          >
            {t("app.topBarMenus.saveLosslessCut")}
          </MenuItem>
          <MenuItem
            disabled={!canExport}
            onSelect={() => void dispatch(openOptimizedExportDialog())}
            suffix="Ctrl+E"
          >
            {t("app.topBarMenus.optimizeExport")}
          </MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
