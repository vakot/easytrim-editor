import { Suspense } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import type { ApplicationCommandId } from "@/app/commands";
import type { ApplicationCommand } from "@/app/commands/core/application-command.types";
import {
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
} from "@/app/commands/core/application-command.utils";
import { useCommandPaletteDialog } from "@/app/hooks/useAppDialog";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";
import { lazyWithPreload } from "@/lib/lazy-component";

import type { AppCommandPaletteDialogContentProps } from "./AppCommandPaletteDialogContent";

const LazyAppCommandPaletteDialogContent = lazyWithPreload<AppCommandPaletteDialogContentProps>(
  () =>
    import("./AppCommandPaletteDialogContent").then((module) => ({
      default: module.AppCommandPaletteDialogContent,
    })),
);

const AppCommandPaletteDialog = Object.assign(
  function AppCommandPaletteDialog() {
    const { closeDialog, isOpen, openDialog } = useCommandPaletteDialog();
    const { commands, executeCommand: executeApplicationCommand } = useApplicationCommands();
    const paletteCommands = commands.filter((command) =>
      isApplicationCommandAvailableOnSurface(command, "palette"),
    );

    useKeyboardShortcut(
      (event) =>
        !isOpen &&
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

    function handleOpenChange(open: boolean) {
      if (open) openDialog();
      else closeDialog();
    }

    function executeCommand(command: ApplicationCommand<ApplicationCommandId>) {
      if (!command.enabled || command.pending) return;
      void executeApplicationCommand(command.id, "palette");
      if (!(command.keepOpen ?? command.checked !== undefined)) closeDialog();
    }

    return (
      <Dialog onOpenChange={handleOpenChange} open={isOpen}>
        <DialogContent
          className="top-1/2 h-[min(60dvh,32rem)] -translate-y-1/2 overflow-hidden rounded-xl! p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <Suspense fallback={null}>
            <LazyAppCommandPaletteDialogContent
              commands={paletteCommands}
              executeCommand={executeCommand}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppCommandPaletteDialogContent.preload() },
);

export { AppCommandPaletteDialog };
