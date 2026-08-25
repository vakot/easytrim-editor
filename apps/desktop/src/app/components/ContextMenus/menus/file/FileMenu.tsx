import { useTranslation } from "react-i18next";

import { useEditorSession } from "@/app/hooks/useEditorSession";
import { useExportPanelController } from "@/app/hooks/useExportPanelController";
import { useSourceDetails } from "@/app/hooks/useSourceDetails";
import { ContextMenu } from "@/components/ui/context-menu";

import type { MenuNavigation } from "../../types";

export function FileMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t } = useTranslation();
  const app = useEditorSession();
  const sourceDetails = useSourceDetails();
  const exportPanel = useExportPanelController();
  const canExport = sourceDetails.isReady;
  const cropApplied =
    sourceDetails.crop.x !== 0 ||
    sourceDetails.crop.y !== 0 ||
    sourceDetails.crop.width !== 1 ||
    sourceDetails.crop.height !== 1;
  const canSave = canExport && !cropApplied;

  return (
    <ContextMenu
      {...navigation}
      options={[
        {
          id: "open-file",
          children: t("app.topBarMenus.openFile"),
          suffix: "Ctrl+O",
          disabled: app.isChoosingSource,
          onSelect: () => void app.handleChooseSource(),
        },
        {
          id: "close-file",
          children: t("app.topBarMenus.closeFile"),
          suffix: "Ctrl+Q",
          disabled: !app.hasSource,
          onSelect: app.handleCloseFile,
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
