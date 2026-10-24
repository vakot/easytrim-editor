import { TooltipContent } from "@easytrim-editor/ui/tooltip";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";

function ShortcutTooltipContent({
  shortcut,
  side,
  title,
}: {
  shortcut: ApplicationShortcut;
  side?: "bottom" | "left" | "right" | "top";
  title: string;
}) {
  const keys = getShortcutDisplayKeys(shortcut);

  return (
    <TooltipContent side={side}>
      {title}
      <KbdGroup>
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
    </TooltipContent>
  );
}

export { ShortcutTooltipContent };
