import { ActivityFeed, ActivityFeedContent, ActivityFeedList } from "@/features/activity";

function ActivityWorkspaceView() {
  return (
    <ActivityFeed>
      <ActivityFeedContent className="-mx-2 **:data-[slot=scroll-area-viewport]:px-2">
        <ActivityFeedList className="py-2" />
      </ActivityFeedContent>
    </ActivityFeed>
  );
}

export { ActivityWorkspaceView };
