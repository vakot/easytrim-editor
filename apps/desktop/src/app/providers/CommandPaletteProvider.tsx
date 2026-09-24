import { type ReactNode, useCallback, useMemo, useState } from "react";

import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { isShortcutEvent } from "@/app/commands/core/application-command.utils";
import { CommandPaletteContext } from "@/app/contexts/command-palette-context";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const openCommandPalette = useCallback(() => {
    setSessionId((current) => current + 1);
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setSessionId((current) => current + 1);
    setIsCommandPaletteOpen(false);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setSessionId((current) => current + 1);
    setIsCommandPaletteOpen((open) => !open);
  }, []);

  useKeyboardShortcut(
    (event) =>
      isShortcutEvent(event, COMMAND_PALETTE_SHORTCUT) &&
      (isCommandPaletteOpen || !isApplicationInteractionBlocked()),
    toggleCommandPalette,
    { allowEditableTarget: true },
  );

  const value = useMemo(
    () => ({
      closeCommandPalette,
      isCommandPaletteOpen,
      openCommandPalette,
      sessionId,
      toggleCommandPalette,
    }),
    [
      closeCommandPalette,
      isCommandPaletteOpen,
      openCommandPalette,
      sessionId,
      toggleCommandPalette,
    ],
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}

export { CommandPaletteProvider };
