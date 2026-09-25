import type { Meta, StoryObj } from "@storybook/react";
import { CircleX } from "lucide-react";

import type { ActivityEntry } from "../../../../lib/activity-projection";
import { ActivityFeedGroupedEntry } from "../ActivityFeedGroupedEntry";

const latestEntryAt = new Date(Date.now() - 3 * 60 * 60 * 1_000).toISOString();

function createEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    data: { count: 1 },
    id: `session-${index}`,
    kind: "files-closed",
    sessionId: "session",
    startedAt: new Date(Date.parse(latestEntryAt) - index * 1_000).toISOString(),
    status: "completed",
    title: "Closed 1 file",
  }));
}

const meta = {
  args: {
    group: {
      entries: createEntries(13),
      icon: CircleX,
      latestEntryAt,
      title: "Closed 13 files",
    },
  },
  component: ActivityFeedGroupedEntry,
  decorators: [
    (Story) => (
      <div className="w-96 border bg-card p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  title: "Features/Activity Feed/Grouped Entry",
} satisfies Meta<typeof ActivityFeedGroupedEntry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SmallCount: Story = {
  args: {
    group: {
      entries: createEntries(3),
      icon: CircleX,
      latestEntryAt,
      title: "Closed 3 files",
    },
  },
};

export const LargeCount: Story = {};

export const CompactSmallCount: Story = {
  args: { compact: true, ...SmallCount.args },
};

export const CompactLargeCount: Story = {
  args: { compact: true },
};
