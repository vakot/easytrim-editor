import { type ReactNode, useCallback, useMemo, useState } from "react";

import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { isShortcutEvent } from "@/app/commands/core/application-command.utils";
import { AppDialogsContext } from "@/app/contexts/app-dialogs-context";
import { AppCommandPaletteDialog } from "@/app/dialogs/AppCommandPaletteDialog";
import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked, isEditableTarget } from "@/lib/hotkeys.utils";

function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const openCommandPalette = useCallback(() => {
    void AppCommandPaletteDialog.preload().catch(() => undefined);
    setCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  const toggleCommandPalette = useCallback(() => {
    void AppCommandPaletteDialog.preload().catch(() => undefined);
    setCommandPaletteOpen((open) => !open);
  }, []);

  const openSettings = useCallback(() => {
    void AppSettingsDialog.preload().catch(() => undefined);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useKeyboardShortcut(
    (event) =>
      isShortcutEvent(event, COMMAND_PALETTE_SHORTCUT) &&
      (isCommandPaletteOpen ||
        (!isEditableTarget(event.target) && !isApplicationInteractionBlocked())),
    toggleCommandPalette,
    { allowEditableTarget: true },
  );

  const value = useMemo(
    () => ({
      closeCommandPalette,
      closeSettings,
      isCommandPaletteOpen,
      isSettingsOpen,
      openCommandPalette,
      openSettings,
      toggleCommandPalette,
    }),
    [
      closeCommandPalette,
      closeSettings,
      isCommandPaletteOpen,
      isSettingsOpen,
      openCommandPalette,
      openSettings,
      toggleCommandPalette,
    ],
  );

  return <AppDialogsContext.Provider value={value}>{children}</AppDialogsContext.Provider>;
}

export { AppDialogsProvider };
