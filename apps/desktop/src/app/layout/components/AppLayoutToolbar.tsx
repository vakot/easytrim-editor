import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { Ping } from "@easytrim-editor/ui/ping";
import { Separator } from "@easytrim-editor/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import type { ApplicationCommandId } from "@/app/commands";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function AppLayoutToolbar() {
  return (
    <aside className="flex flex-col gap-1.5 pl-1.5">
      <section className="flex flex-1 flex-col gap-1.5">
        <AppLayoutTool commandId="open-workspace-view-sources" />
        <AppLayoutTool commandId="open-workspace-view-exportQueue" />
        <AppLayoutTool commandId="open-workspace-view-activity" />
        <AppLayoutTool commandId="open-workspace-view-history" />
        <AppLayoutTool commandId="open-chapters" />
      </section>

      <Separator className="bg-muted" />

      <section className="grid items-center gap-1.5">
        <AppLayoutTool commandId="open-achievements" />
        <AppLayoutTool commandId="open-statistics" />
        <AppLayoutTool commandId="open-settings" />
      </section>
    </aside>
  );
}

function AppLayoutTool({
  className,
  commandId,
}: {
  className?: string;
  commandId: ApplicationCommandId;
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-label={command.attention ? `${command.label}, ${command.attention}` : command.label}
          className={cn("relative text-muted-foreground", className)}
          disabled={!command.enabled || command.pending}
          onClick={() => void executeCommand(command.id, "sidebar")}
          onFocus={command.preload}
          onPointerEnter={command.preload}
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          <ApplicationCommandIcon command={command} />
          {command.attention ? (
            <Ping
              aria-hidden="true"
              className="top-1.5 right-1.5 size-2 before:size-2 motion-reduce:before:animate-none"
              data-slot="attention"
            />
          ) : null}
        </Button>
      </TooltipTrigger>

      {command.shortcut ? (
        <ShortcutTooltipContent shortcut={command.shortcut} side="right" title={command.label} />
      ) : (
        <TooltipContent side="right">{command.label}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { AppLayoutToolbar };
