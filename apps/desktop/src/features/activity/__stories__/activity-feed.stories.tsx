import type { Meta, StoryObj } from "@storybook/react";

import type { ActivityEntry } from "../activity-projection";
import { ActivityFeedView } from "../ActivityFeed";

const now = new Date(2026, 7, 31, 18).getTime();
const entries: ActivityEntry[] = [
  {
    action: {
      kind: "open",
      path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-final-optimized.mp4",
    },
    id: "session-1:render-1:ffmpeg.export.completed",
    kind: "render-completed",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-final-optimized.mp4",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 31, 17, 45).toISOString(),
    title: "Optimized render completed",
  },
  {
    action: {
      kind: "open",
      path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-fast-cut.mkv",
    },
    id: "session-1:cut-1:ffmpeg.export.completed",
    kind: "fast-cut-completed",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-fast-cut.mkv",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 31, 10, 20).toISOString(),
    title: "Fast cut completed",
  },
  {
    id: "session-1:restore-1:source.file-restore.completed",
    kind: "file-restored",
    path: "C:\\Users\\Editor\\Videos\\Source Footage\\camera-a\\interview-source.mp4",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 30, 15, 5).toISOString(),
    title: "File restored",
  },
  {
    action: {
      kind: "restore",
      path: "C:\\Users\\Editor\\Videos\\Source Footage\\camera-b\\deleted-source.mp4",
      targetId: "export-delete-1",
    },
    id: "session-1:delete-1:source.file-delete.completed",
    kind: "file-deleted",
    path: "C:\\Users\\Editor\\Videos\\Source Footage\\camera-b\\deleted-source.mp4",
    sessionId: "session-1",
    timestamp: new Date(2026, 7, 30, 9, 30).toISOString(),
    title: "File deleted",
  },
];

const meta = {
  args: {
    now,
    onAction: () => undefined,
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
