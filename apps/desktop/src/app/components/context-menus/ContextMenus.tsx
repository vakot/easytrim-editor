import { useTranslation } from "react-i18next";

import { ContextMenuFile } from "./components/ContextMenuFile";
import { ContextMenuHelp } from "./components/ContextMenuHelp";
import { ContextMenuQueue } from "./components/ContextMenuQueue";
import { ContextMenuSettings } from "./components/ContextMenuSettings";
import { ContextMenuView } from "./components/ContextMenuView";
import { useContextMenuNavigation } from "./hooks/useContextMenuNavigation";

export function ContextMenus() {
  const { t } = useTranslation();
  const navigation = useContextMenuNavigation();

  return (
    <nav className="flex h-full items-center gap-0.5" aria-label={t("app.topBarMenus.label")}>
      <ContextMenuFile navigation={navigation.file} />
      <ContextMenuView navigation={navigation.view} />
      <ContextMenuQueue navigation={navigation.queue} />
      <ContextMenuSettings navigation={navigation.settings} />
      <ContextMenuHelp navigation={navigation.help} />
    </nav>
  );
}
