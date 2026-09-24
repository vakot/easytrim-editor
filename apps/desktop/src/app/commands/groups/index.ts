import { useMemo } from "react";

import { useAppearanceCommandGroup } from "@/app/commands/groups/appearance.commands";
import { useFileCommandGroup } from "@/app/commands/groups/file.commands";
import { useHelpCommandGroup } from "@/app/commands/groups/help.commands";
import { useLayoutCommandGroup } from "@/app/commands/groups/layout.commands";
import { usePreferencesCommandGroup } from "@/app/commands/groups/preferences.commands";
import { usePreviewCommandGroup } from "@/app/commands/groups/preview.commands";
import { useQueueCommandGroup } from "@/app/commands/groups/queue.commands";

function useApplicationCommandGroups() {
  const file = useFileCommandGroup();
  const help = useHelpCommandGroup();
  const appearance = useAppearanceCommandGroup();
  const preferences = usePreferencesCommandGroup();
  const queue = useQueueCommandGroup();
  const layout = useLayoutCommandGroup();
  const preview = usePreviewCommandGroup();

  return useMemo(
    () => [file, help, appearance, preferences, queue, layout, preview] as const,
    [appearance, file, help, layout, preferences, preview, queue],
  );
}

type ApplicationCommandGroups = ReturnType<typeof useApplicationCommandGroups>;
type ApplicationCommandId = ApplicationCommandGroups[number]["commands"][number]["id"];

export { useApplicationCommandGroups };
export type { ApplicationCommandId, ApplicationCommandGroups };
