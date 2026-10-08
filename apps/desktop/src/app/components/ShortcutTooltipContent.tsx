import { Kbd, KbdGroup, KbdSeparator } from "@/components/ui/kbd";
import { TooltipContent } from "@/components/ui/tooltip";

import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";

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
        {keys.map((key, index) => (
          <span className="inline-flex items-center gap-1" key={key}>
            {index > 0 ? <KbdSeparator>+</KbdSeparator> : null}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </KbdGroup>
    </TooltipContent>
  );
}

export { ShortcutTooltipContent };
