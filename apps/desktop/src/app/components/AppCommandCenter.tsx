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
    <ButtonGroup>
      <AppCommandCenterTrigger expanded={startupComplete} />
      <MediaToolsStatus presentation={startupComplete ? "compact" : "startup"} />
    </ButtonGroup>
  );
}

function AppCommandCenterTrigger({ expanded }: { expanded: boolean }) {
  const { t } = useTranslation();
  const { openCommandPalette } = useCommandPalette();
  const shouldReduceMotion = useReducedMotion();

  const duration = shouldReduceMotion ? 0 : 0.3;

  return (
    <MotionButton
      animate={{
        width: expanded ? "auto" : 0,
        paddingLeft: expanded ? 8 : 0,
        paddingRight: expanded ? 8 : 0,
        borderWidth: expanded ? 1 : 0,
      }}
      aria-hidden={!expanded}
      aria-label={t("app.messages.commandPalettePlaceholder")}
      className="min-w-0 shrink-0 overflow-hidden whitespace-nowrap text-muted-foreground"
      data-no-drag="true"
      initial={false}
      onClick={openCommandPalette}
      size="xs"
      tabIndex={expanded ? 0 : -1}
      transition={{
        duration,
        ease: "easeOut",
      }}
      variant="outline"
    >
      <motion.span
        animate={{
          opacity: expanded ? 1 : 0,
          x: expanded ? 0 : 6,
        }}
        className="flex shrink-0 items-center gap-1.5"
        initial={false}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.2,
          ease: "easeOut",
          delay: expanded && !shouldReduceMotion ? 0.08 : 0,
        }}
      >
        <Search aria-hidden="true" className="size-3.5" />

        <span>{t("app.messages.commandPalettePlaceholder")}</span>

        <span aria-label={getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT)} className="ml-0.5">
          <KbdGroup>
            {getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT).map((key) => (
              <Kbd className="h-4" key={key}>
                {key}
              </Kbd>
            ))}
          </KbdGroup>
        </span>
      </motion.span>
    </MotionButton>
  );
}

export { AppCommandCenter };
