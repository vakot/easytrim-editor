import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function MenuBarSettings() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();

  return (
    <Button
      className="text-foreground/80"
      onClick={() => void executeCommand("open-settings", "menu")}
      size="sm"
      type="button"
      variant="ghost"
    >
      {t("settings.title")}
    </Button>
  );
}

export { MenuBarSettings };
