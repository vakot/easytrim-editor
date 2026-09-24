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
import { cn } from "@/lib/class-names.utils";

function AppCommandCenter() {
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

  return (
    <ButtonGroup
      className={cn(
        "h-7 items-center rounded-lg",
        !startupComplete &&
          "*:data-media-tools-trigger:rounded-lg! *:data-media-tools-trigger:border-l!",
      )}
    >
      <Button
        aria-hidden={!startupComplete}
        aria-label={t("app.messages.commandPalettePlaceholder")}
        className={cn(
          "h-7 shrink-0 justify-start gap-2 overflow-hidden whitespace-nowrap",
          "border-border bg-muted text-xs font-normal text-muted-foreground",
          "transition-[width,padding,opacity,border-width] duration-300 ease-out",
          "hover:text-foreground",
          startupComplete
            ? "w-64 border px-2.5 opacity-100"
            : "pointer-events-none w-0 border-0 px-0 opacity-0",
        )}
        onClick={openCommandPalette}
        size="sm"
        tabIndex={startupComplete ? 0 : -1}
        variant="outline"
      >
        <div className="flex w-full justify-between gap-3">
          <span
            className={cn(
              "flex shrink-0 items-center gap-2 transition-opacity duration-150",
              startupComplete ? "opacity-100 delay-75" : "opacity-0",
            )}
          >
            <Search aria-hidden="true" className="size-3.5" />

            <span>{t("app.messages.commandPalettePlaceholder")}</span>
          </span>

          <span aria-label={getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT)} className="ml-1">
            <KbdGroup>
              {getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT).map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </span>
        </div>
      </Button>

      <MediaToolsStatus presentation={startupComplete ? "compact" : "startup"} />
    </ButtonGroup>
  );
}

export { AppCommandCenter };
