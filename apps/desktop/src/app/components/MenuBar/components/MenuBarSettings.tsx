import { useTranslation } from "react-i18next";

import { Button } from "@easytrim-editor/ui/button";

import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function MenuBarSettings() {
  const { t } = useTranslation();
  const command = useApplicationCommand("open-settings");
  const { executeCommand } = useApplicationCommands();

  return (
    <Button
      className="text-foreground/80"
      onClick={() => void executeCommand("open-settings", "menu")}
      onFocus={command.preload}
      onPointerEnter={command.preload}
      size="sm"
      type="button"
      variant="ghost"
    >
      {t("settings.title")}
    </Button>
  );
}

export { MenuBarSettings };
