import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import {
  getShortcutAriaValue,
  getShortcutDisplayKeys,
} from "@/app/commands/core/application-command.utils";
import { useCommandPalette } from "@/app/contexts/command-palette-context";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectCapabilities } from "@/app/store/slices/source-slice";
import { MediaToolsStatus } from "@/features/media";

function AppTitleBarCommandCenter() {
  const { t } = useTranslation();
  const { openCommandPalette } = useCommandPalette();
  const capabilities = useAppSelector(selectCapabilities);
  const [startupComplete, setStartupComplete] = useState(false);

  useEffect(() => {
    if (startupComplete || capabilities.status === "checking") return;
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const timeout = window.setTimeout(() => setStartupComplete(true), 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => setStartupComplete(true), 800);
    return () => window.clearTimeout(timeout);
  }, [capabilities.status, startupComplete]);

  if (!startupComplete) {
    return (
      <div className="flex h-full items-center px-2 transition-[max-width,opacity,transform] duration-250 motion-reduce:transition-none">
        <MediaToolsStatus presentation="startup" />
      </div>
    );
  }

  return (
    <ButtonGroup className="h-7 items-center rounded-lg transition-[max-width,opacity,transform] duration-250 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-reduce:animate-none motion-reduce:transition-none">
      <Button
        aria-label={t("app.messages.commandPalettePlaceholder")}
        className="h-7 gap-2 rounded-r-none border-border bg-muted px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground"
        onClick={openCommandPalette}
        size="sm"
        variant="outline"
      >
        <Search aria-hidden="true" className="size-3.5" />
        <span>{t("app.messages.commandPalettePlaceholder")}</span>
        <span aria-label={getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT)} className="ml-1">
          <KbdGroup>
            {getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT).map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </span>
      </Button>

      <MediaToolsStatus />
    </ButtonGroup>
  );
}

export { AppTitleBarCommandCenter };
