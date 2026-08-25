import { useTranslation } from "react-i18next";

import { HelpMenu } from "./menus/help";
import { FileMenu } from "./menus/file";
import { QueueMenu } from "./menus/queue";
import { SettingsMenu } from "./menus/settings";
import { ViewMenu } from "./menus/view";
import { useContextMenuNavigation } from "./hooks/useContextMenuNavigation";

export function ContextMenus() {
  const { t } = useTranslation();
  const navigation = useContextMenuNavigation();

  return (
    <nav className="flex h-full items-center gap-0.5" aria-label={t("app.topBarMenus.label")}>
      <FileMenu navigation={navigation.file} />
      <ViewMenu navigation={navigation.view} />
      <QueueMenu navigation={navigation.queue} />
      <SettingsMenu navigation={navigation.settings} />
      <HelpMenu navigation={navigation.help} />
    </nav>
  );
}
