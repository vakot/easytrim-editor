import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";

function TimelineShortcutTooltip({
  children,
  disabled,
  shortcut,
  tooltip,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  shortcut?: ApplicationShortcut;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
          {children}
        </span>
      </TooltipTrigger>
      {shortcut ? (
        <ShortcutTooltipContent shortcut={shortcut} title={tooltip} />
      ) : (
        <TooltipContent>{tooltip}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { TimelineShortcutTooltip };
