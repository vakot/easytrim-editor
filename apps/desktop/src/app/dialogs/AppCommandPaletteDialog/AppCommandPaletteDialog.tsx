import { Suspense } from "react";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import type { ApplicationCommandId } from "@/app/commands";
import type { ApplicationCommand } from "@/app/commands/core/application-command.types";
import {
  getApplicationCommandShortcuts,
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
} from "@/app/commands/core/application-command.utils";
import { useCommandPaletteDialog } from "@/app/hooks/useAppDialog";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";
import { lazyWithPreload } from "@/lib/lazy-component";

import type { AppCommandPaletteDialogContentProps } from "./AppCommandPaletteDialogContent";

const useAppCommandPaletteDialogScope = createDialogScope();

const LazyAppCommandPaletteDialogContent = lazyWithPreload<AppCommandPaletteDialogContentProps>(
  () =>
    import("./AppCommandPaletteDialogContent").then((module) => ({
      default: module.AppCommandPaletteDialogContent,
    })),
);

const AppCommandPaletteDialog = Object.assign(
  function AppCommandPaletteDialog({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
    const dialogScope = useAppCommandPaletteDialogScope(__scopeDialog);
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
            getApplicationCommandShortcuts(command).some((shortcut) =>
              isShortcutEvent(event, shortcut),
            ),
        ),
      (event) => {
        const command = commands.find(
          (candidate) =>
            isApplicationCommandAvailableOnSurface(candidate, "hotkey") &&
            candidate.enabled &&
            !candidate.pending &&
            getApplicationCommandShortcuts(candidate).some((shortcut) =>
              isShortcutEvent(event, shortcut),
            ),
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
      <Dialog {...dialogScope} onOpenChange={handleOpenChange} open={isOpen}>
        <DialogContent
          {...dialogScope}
          className="top-1/2 h-[min(60dvh,32rem)] -translate-y-1/2 overflow-hidden rounded-xl! p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <Suspense fallback={null}>
            <LazyAppCommandPaletteDialogContent
              __scopeDialog={dialogScope.__scopeDialog}
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
