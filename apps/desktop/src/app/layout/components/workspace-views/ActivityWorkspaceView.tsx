import { ScrollArea } from "@/components/ui/scroll-area";

import { ActivityFeed } from "@/features/activity";

function ActivityWorkspaceView() {
  return (
    <ScrollArea className="-mx-2 flex-1 px-2 before:top-2">
      <ActivityFeed className="pb-1" />
    </ScrollArea>
  );
}

export { ActivityWorkspaceView };
