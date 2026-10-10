import { ScrollArea } from "@/components/ui/scroll-area";

import { ActivityFeed } from "@/features/activity";

function ActivityWorkspaceView() {
  return (
    <ScrollArea className="flex-1 before:top-2">
      <ActivityFeed className="pb-3" />
    </ScrollArea>
  );
}

export { ActivityWorkspaceView };
