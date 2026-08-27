import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/hooks";
import { useAppDispatch } from "@/app/store/hooks";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { selectIsChoosingSource } from "@/app/store/slices/import-workflow-slice";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemIcon,
  MenuItemLabel,
  MenuItemSuffix,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

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
          onSelect={() => void dispatch(chooseSourceRequested())}
        >
          <MenuItemIcon />
          <MenuItemLabel>{t("app.topBarMenus.openFile")}</MenuItemLabel>
          <MenuItemSuffix>Ctrl+O</MenuItemSuffix>
        </MenuItem>
        <MenuItem
          disabled={!hasSource}
          onSelect={() => void dispatch(closeActiveImportedItemRequested())}
        >
          <MenuItemIcon />
          <MenuItemLabel>{t("app.topBarMenus.closeFile")}</MenuItemLabel>
          <MenuItemSuffix>Ctrl+Q</MenuItemSuffix>
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!canSave} onSelect={() => void dispatch(startFastCutRequested())}>
          <MenuItemIcon />
          <MenuItemLabel>{t("app.topBarMenus.saveLosslessCut")}</MenuItemLabel>
          <MenuItemSuffix>Ctrl+S</MenuItemSuffix>
        </MenuItem>
        <MenuItem disabled={!canExport} onSelect={() => void dispatch(openOptimizedExportDialog())}>
          <MenuItemIcon />
          <MenuItemLabel>{t("app.topBarMenus.optimizeExport")}</MenuItemLabel>
          <MenuItemSuffix>Ctrl+E</MenuItemSuffix>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
