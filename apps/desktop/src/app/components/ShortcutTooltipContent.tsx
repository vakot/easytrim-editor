import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { TooltipContent } from "@/components/ui/tooltip";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";

function ShortcutTooltipContent({
  shortcut,
  title,
}: {
  shortcut: ApplicationShortcut;
  title: string;
}) {
  const keys = getShortcutDisplayKeys(shortcut);

  return (
    <TooltipContent>
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
