import { useAppearanceCommandGroups } from "./appearance";
import { useFileCommandGroups } from "./file";
import { useHelpCommandGroups } from "./help";
import { useLayoutCommandGroups } from "./layout";
import { usePreferencesCommandGroups } from "./preferences";
import { usePreviewCommandGroups } from "./preview";
import { useQueueCommandGroups } from "./queue";

function useApplicationCommandGroups() {
  const file = useFileCommandGroups();
  const help = useHelpCommandGroups();
  const appearance = useAppearanceCommandGroups();
  const preferences = usePreferencesCommandGroups();
  const queue = useQueueCommandGroups();
  const layout = useLayoutCommandGroups();
  const preview = usePreviewCommandGroups();
  return [
    ...file,
    ...help,
    ...appearance,
    ...preferences,
    ...queue,
    ...layout,
    ...preview,
  ] as const;
}

type ApplicationCommandId = ReturnType<
  typeof useApplicationCommandGroups
>[number]["commands"][number]["id"];

export { useApplicationCommandGroups };
export type { ApplicationCommandId };
