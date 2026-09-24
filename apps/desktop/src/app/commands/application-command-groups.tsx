import { useAppearanceCommandGroups } from "./appearance";
import { useFileCommandGroups } from "./file";
import { useHelpCommandGroup } from "./help";
import { useLayoutCommandGroups } from "./layout";
import { usePreferencesCommandGroups } from "./preferences";
import { usePreviewCommandGroup } from "./preview";
import { useQueueCommandGroups } from "./queue";

function useApplicationCommandGroups() {
  const file = useFileCommandGroups();
  const help = useHelpCommandGroup();
  const appearance = useAppearanceCommandGroups();
  const preferences = usePreferencesCommandGroups();
  const queue = useQueueCommandGroups();
  const layout = useLayoutCommandGroups();
  const preview = usePreviewCommandGroup();
  return [...file, help, ...appearance, ...preferences, ...queue, ...layout, preview] as const;
}

type ApplicationCommandId = ReturnType<
  typeof useApplicationCommandGroups
>[number]["commands"][number]["id"];

export { useApplicationCommandGroups };
export type { ApplicationCommandId };
