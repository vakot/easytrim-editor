import type { Meta, StoryObj } from "@storybook/react";

import type { ActivityEntry } from "../activity-projection";
import { ActivityFeedView } from "../ActivityFeed";

const now = new Date(2026, 7, 31, 18).getTime();
const entries: ActivityEntry[] = [
  {
    id: "session-1:render-1:ffmpeg.export.completed",
    kind: "render-completed",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 31, 17, 45).toISOString(),
    title: "Optimized render completed",
  },
  {
    id: "session-1:cut-1:ffmpeg.export.completed",
    kind: "fast-cut-completed",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 31, 10, 20).toISOString(),
    title: "Fast cut completed",
  },
  {
    id: "session-1:restore-1:source.file-restore.completed",
    kind: "file-restored",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 30, 15, 5).toISOString(),
    title: "File restored",
  },
  {
    id: "session-1:delete-1:source.file-delete.completed",
    kind: "file-deleted",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 30, 9, 30).toISOString(),
    title: "File deleted",
  },
];

const meta = {
  args: {
    dateLabels: { today: "Today", yesterday: "Yesterday" },
    emptyLabel: "Completed actions will appear here.",
    locale: "en",
    now,
    title: "Activity",
  },
  component: ActivityFeedView,
  decorators: [
    (Story) => (
      <div className="h-96 w-80 border bg-card">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  title: "Features/Activity Feed",
} satisfies Meta<typeof ActivityFeedView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MultipleDates: Story = { args: { entries } };

export const Empty: Story = { args: { entries: [] } };
