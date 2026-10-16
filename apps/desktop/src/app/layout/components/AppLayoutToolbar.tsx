import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ApplicationCommandId } from "@/app/commands";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { cn } from "@/lib/class-names.utils";

function AppLayoutToolbar() {
  return (
    <aside className="flex flex-col gap-1.5 pl-1.5">
      <section className="flex flex-1 flex-col gap-1.5">
        <AppLayoutTool commandId="open-workspace-view-sources" />
        <AppLayoutTool commandId="open-workspace-view-exportQueue" />
        <AppLayoutTool commandId="open-workspace-view-activity" />
        <AppLayoutTool commandId="open-chapters" />
      </section>

      <Separator className="bg-muted" />

      <section className="grid items-center gap-1.5">
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
          aria-label={command.label}
          className={cn("text-muted-foreground", className)}
          disabled={!command.enabled || command.pending}
          onClick={() => void executeCommand(command.id, "sidebar")}
          onFocus={command.preload}
          onPointerEnter={command.preload}
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          <ApplicationCommandIcon command={command} />
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
