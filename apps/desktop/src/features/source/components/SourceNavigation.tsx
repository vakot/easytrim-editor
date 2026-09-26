import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { cn } from "@/lib/class-names.utils";

function SourceNavigation({ className }: { className?: string }) {
  const { executeCommand } = useApplicationCommands();
  const previousCommand = useApplicationCommand("previous-source");
  const nextCommand = useApplicationCommand("next-source");

  return (
    <div className={cn("flex", className)}>
      <SourceNavigationButton
        command={previousCommand}
        onClick={() => void executeCommand("previous-source", "button")}
      />

      <SourceNavigationButton
        command={nextCommand}
        onClick={() => void executeCommand("next-source", "button")}
      />
    </div>
  );
}

function SourceNavigationButton({
  command,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "disabled"> & {
  command: NonNullable<ReturnType<typeof useApplicationCommand>>;
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
      <TooltipContent>{command.label}</TooltipContent>
    </Tooltip>
  );
}

export { SourceNavigation };
