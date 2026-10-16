import type { Meta, StoryObj } from "@storybook/react";

import { ActivityFeed, ActivityFeedContent, ActivityFeedList } from "../ActivityFeed";

function ActivityFeedStory() {
  return (
    <ActivityFeed>
      <ActivityFeedContent>
        <ActivityFeedList />
      </ActivityFeedContent>
    </ActivityFeed>
  );
}

const meta = {
  component: ActivityFeedStory,
  decorators: [
    (Story) => (
      <div className="h-96 w-80 border bg-card">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  title: "Features/Activity/Activity Feed",
} satisfies Meta<typeof ActivityFeedStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
