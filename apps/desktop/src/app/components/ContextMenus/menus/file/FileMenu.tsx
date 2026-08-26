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
import { ContextMenu } from "@/components/ui/context-menu";

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
    <ContextMenu
      {...navigation}
      options={[
        {
          id: "open-file",
          children: t("app.topBarMenus.openFile"),
          suffix: "Ctrl+O",
          disabled: isChoosingSource,
          onSelect: () => void dispatch(chooseSourceRequested()),
        },
        {
          id: "close-file",
          children: t("app.topBarMenus.closeFile"),
          suffix: "Ctrl+Q",
          disabled: !hasSource,
          onSelect: () => void dispatch(closeActiveImportedItemRequested()),
        },
        { id: "file-divider", separator: true },
        {
          id: "save-lossless-cut",
          children: t("app.topBarMenus.saveLosslessCut"),
          suffix: "Ctrl+S",
          disabled: !canSave,
          onSelect: () => void dispatch(startFastCutRequested()),
        },
        {
          id: "optimize-export",
          children: t("app.topBarMenus.optimizeExport"),
          suffix: "Ctrl+E",
          disabled: !canExport,
          onSelect: () => void dispatch(openOptimizedExportDialog()),
        },
      ]}
    >
      {t("app.topBarMenus.file")}
    </ContextMenu>
  );
}
