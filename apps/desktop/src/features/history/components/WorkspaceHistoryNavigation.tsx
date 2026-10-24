import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import type { ApplicationCommand } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function WorkspaceHistoryNavigation({ className }: { className?: string }) {
  const { executeCommand } = useApplicationCommands();
  const undoCommand = useApplicationCommand("undo");
  const redoCommand = useApplicationCommand("redo");

  return (
    <div className={cn("flex", className)}>
      <HistoryNavigationButton
        command={undoCommand}
        onClick={() => void executeCommand("undo", "button")}
      />
      <HistoryNavigationButton
        command={redoCommand}
        onClick={() => void executeCommand("redo", "button")}
      />
    </div>
  );
}

function HistoryNavigationButton({
  command,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label" | "disabled"> & {
  command: ApplicationCommand;
}) {
  const shortcut = command.shortcut ? getShortcutAriaValue(command.shortcut) : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-keyshortcuts={shortcut}
          aria-label={command.label}
          className="text-muted-foreground hover:text-foreground"
          disabled={!command.enabled || command.pending}
          size="icon-sm"
          variant="ghost"
          {...props}
        >
          <ApplicationCommandIcon command={command} />
        </Button>
      </TooltipTrigger>
      {command.shortcut ? (
        <ShortcutTooltipContent shortcut={command.shortcut} title={command.label} />
      ) : (
        <TooltipContent>{command.label}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { WorkspaceHistoryNavigation };
