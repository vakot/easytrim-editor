import { Suspense } from "react";

import type { ApplicationCommandId } from "@/app/commands";
import type { ApplicationCommand } from "@/app/commands/core/application-command.types";
import {
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
} from "@/app/commands/core/application-command.utils";
import { useCommandPalette } from "@/app/contexts/command-palette-context";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

import { LazyCommandPaletteDialog } from "./command-palette.loader";

function CommandPalette() {
  const { closeCommandPalette, isCommandPaletteOpen, openCommandPalette } = useCommandPalette();
  const { commands, executeCommand: executeApplicationCommand } = useApplicationCommands();
  const paletteCommands = commands.filter((command) =>
    isApplicationCommandAvailableOnSurface(command, "palette"),
  );

  useKeyboardShortcut(
    (event) =>
      !isCommandPaletteOpen &&
      !isApplicationInteractionBlocked() &&
      commands.some(
        (command) =>
          isApplicationCommandAvailableOnSurface(command, "hotkey") &&
          command.enabled &&
          !command.pending &&
          command.shortcut !== undefined &&
          isShortcutEvent(event, command.shortcut),
      ),
    (event) => {
      const command = commands.find(
        (candidate) =>
          isApplicationCommandAvailableOnSurface(candidate, "hotkey") &&
          candidate.enabled &&
          !candidate.pending &&
          candidate.shortcut !== undefined &&
          isShortcutEvent(event, candidate.shortcut),
      );

      if (command) void executeApplicationCommand(command.id, "hotkey");
    },
    { allowAltModifier: true },
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) openCommandPalette();
    else closeCommandPalette();
  }

  function executeCommand(command: ApplicationCommand<ApplicationCommandId>) {
    if (!command.enabled || command.pending) return;
    void executeApplicationCommand(command.id, "palette");
    if (!(command.keepOpen ?? command.checked !== undefined)) closeCommandPalette();
  }

  return isCommandPaletteOpen ? (
    <Suspense fallback={null}>
      <LazyCommandPaletteDialog
        commands={paletteCommands}
        executeCommand={executeCommand}
        onOpenChange={handleOpenChange}
      />
    </Suspense>
  ) : null;
}

export { CommandPalette };
