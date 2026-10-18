import { useAppearanceCommandGroups } from "./appearance";
import { useFileCommandGroups } from "./file";
import { useHelpCommandGroups } from "./help";
import { useHistoryCommandGroups } from "./history";
import { useLayoutCommandGroups } from "./layout";
import { usePreferencesCommandGroups } from "./preferences";
import { usePreviewCommandGroups } from "./preview";
import { useQueueCommandGroups } from "./queue";
import { useSourceCommandGroups } from "./source";
import { useWorkspaceViewCommandGroups } from "./workspace-views";

function useApplicationCommandGroups() {
  const file = useFileCommandGroups();
  const history = useHistoryCommandGroups();
  const help = useHelpCommandGroups();
  const appearance = useAppearanceCommandGroups();
  const preferences = usePreferencesCommandGroups();
  const queue = useQueueCommandGroups();
  const layout = useLayoutCommandGroups();
  const preview = usePreviewCommandGroups();
  const source = useSourceCommandGroups();
  const workspaceViews = useWorkspaceViewCommandGroups();
  return [
    ...file,
    ...history,
    ...help,
    ...appearance,
    ...preferences,
    ...queue,
    ...layout,
    ...preview,
    ...source,
    ...workspaceViews,
  ] as const;
}

type ApplicationCommandId = ReturnType<
  typeof useApplicationCommandGroups
>[number]["commands"][number]["id"];

export { useApplicationCommandGroups };
export type { ApplicationCommandId };
