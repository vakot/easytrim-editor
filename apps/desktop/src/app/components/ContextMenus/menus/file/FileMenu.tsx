import { useTranslation } from "react-i18next";

import { useEditorSession } from "@/app/hooks/useEditorSession";
import { useExportPanelController } from "@/app/hooks/useExportPanelController";
import { useAppSelector } from "@/app/store/hooks";
import { useAppDispatch } from "@/app/store/hooks";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/session-slice";
import { selectIsChoosingSource } from "@/app/store/slices/import-workflow-slice";
import {
  chooseSourceRequested,
  closeSourceRequested,
} from "@/app/store/thunks/source-media-thunks";
import { ContextMenu } from "@/components/ui/context-menu";

import type { MenuNavigation } from "../../types";

export function FileMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t } = useTranslation();
  const app = useEditorSession();
  const dispatch = useAppDispatch();
  const exportPanel = useExportPanelController();
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const cropApplied =
    app.crop.x !== 0 || app.crop.y !== 0 || app.crop.width !== 1 || app.crop.height !== 1;
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
          onSelect: () => void dispatch(closeSourceRequested()),
        },
        { id: "file-divider", separator: true },
        {
          id: "save-lossless-cut",
          children: t("app.topBarMenus.saveLosslessCut"),
          suffix: "Ctrl+S",
          disabled: !canSave,
          onSelect: exportPanel.startFastCut,
        },
        {
          id: "optimize-export",
          children: t("app.topBarMenus.optimizeExport"),
          suffix: "Ctrl+E",
          disabled: !canExport,
          onSelect: exportPanel.openOptimizedDialog,
        },
      ]}
    >
      {t("app.topBarMenus.file")}
    </ContextMenu>
  );
}
