import { useTranslation } from "react-i18next";

import { ContextMenu } from "@/components/ui/context-menu";

import type { MenuNavigation } from "../../types";

interface FileMenuProps {
  navigation: MenuNavigation;
  isChoosingSource: boolean;
  hasSource: boolean;
  canSave: boolean;
  canExport: boolean;
  onChooseSource: () => void;
  onCloseFile: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function FileMenu({
  navigation,
  isChoosingSource,
  hasSource,
  canSave,
  canExport,
  onChooseSource,
  onCloseFile,
  onSave,
  onExport,
}: FileMenuProps) {
  const { t } = useTranslation();

  return (
    <ContextMenu
      {...navigation}
      options={[
        {
          id: "open-file",
          children: t("app.topBarMenus.openFile"),
          suffix: "Ctrl+O",
          disabled: isChoosingSource,
          onSelect: onChooseSource,
        },
        {
          id: "close-file",
          children: t("app.topBarMenus.closeFile"),
          suffix: "Ctrl+Q",
          disabled: !hasSource,
          onSelect: onCloseFile,
        },
        { id: "file-divider", separator: true },
        {
          id: "save-lossless-cut",
          children: t("app.topBarMenus.saveLosslessCut"),
          suffix: "Ctrl+S",
          disabled: !canSave,
          onSelect: onSave,
        },
        {
          id: "optimize-export",
          children: t("app.topBarMenus.optimizeExport"),
          suffix: "Ctrl+E",
          disabled: !canExport,
          onSelect: onExport,
        },
      ]}
    >
      {t("app.topBarMenus.file")}
    </ContextMenu>
  );
}
