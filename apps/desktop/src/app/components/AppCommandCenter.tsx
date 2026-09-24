import { Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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

const MotionButton = motion.create(Button);

function AppCommandCenter() {
  const capabilities = useAppSelector(selectCapabilities);
  const [startupComplete, setStartupComplete] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (startupComplete || capabilities.status === "checking") return;

    if (shouldReduceMotion) {
      const timeout = window.setTimeout(() => setStartupComplete(true), 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => setStartupComplete(true), 900);
    return () => window.clearTimeout(timeout);
  }, [capabilities.status, shouldReduceMotion, startupComplete]);

  return (
    <ButtonGroup className="w-full max-w-lg justify-center">
      {startupComplete && <AppCommandCenterTrigger />}
      <MediaToolsStatus presentation={startupComplete ? "compact" : "default"} />
    </ButtonGroup>
  );
}

function AppCommandCenterTrigger() {
  const { t } = useTranslation();
  const { openCommandPalette } = useCommandPalette();
  const shouldReduceMotion = useReducedMotion();

  return (
    <MotionButton
      animate={{
        flexGrow: 1,
        opacity: 1,
        borderWidth: 1,
      }}
      aria-label={t("app.messages.commandPalettePlaceholder")}
      className={cn(
        "min-w-0 basis-0 overflow-hidden px-0 whitespace-nowrap text-muted-foreground",
        "transition-colors",
      )}
      data-no-drag="true"
      initial={
        shouldReduceMotion
          ? false
          : {
              flexGrow: 0,
              opacity: 0,
              borderWidth: 0,
            }
      }
      onClick={openCommandPalette}
      size="xs"
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: "easeOut",
      }}
      variant="outline"
    >
      <span className="flex min-w-max flex-1 items-center justify-between gap-3 px-2">
        <span className="flex items-center gap-1.5">
          <Search aria-hidden="true" className="size-3.5" />
          <span>{t("app.messages.commandPalettePlaceholder")}</span>
        </span>

        <span aria-label={getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT)}>
          <KbdGroup>
            {getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT).map((key) => (
              <Kbd className="h-4" key={key}>
                {key}
              </Kbd>
            ))}
          </KbdGroup>
        </span>
      </span>
    </MotionButton>
  );
}

export { AppCommandCenter };
