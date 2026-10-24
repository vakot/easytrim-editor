import type { ComponentProps } from "react";

import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function SourceListNavigation({ className }: { className?: string }) {
  const { executeCommand } = useApplicationCommands();
  const previousCommand = useApplicationCommand("previous-source");
  const nextCommand = useApplicationCommand("next-source");

  return (
    <div className={cn("flex gap-1", className)}>
      <SourceListNavigationButton
        command={previousCommand}
        onClick={() => void executeCommand("previous-source", "button")}
      />

      <SourceListNavigationButton
        command={nextCommand}
        onClick={() => void executeCommand("next-source", "button")}
      />
    </div>
  );
}

function SourceListNavigationButton({
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
      {command.shortcut ? (
        <ShortcutTooltipContent shortcut={command.shortcut} title={command.label} />
      ) : (
        <TooltipContent>{command.label}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { SourceListNavigation };
