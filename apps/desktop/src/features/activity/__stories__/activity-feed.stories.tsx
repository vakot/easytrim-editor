import type { Meta, StoryObj } from "@storybook/react";

import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";

import type { ActivityEntry } from "../activity-projection";
import { ActivityFeedView } from "../ActivityFeed";

const now = new Date(2026, 7, 31, 18).getTime();
const entries: ActivityEntry[] = [
  {
    id: "current-session:render-pending:ffmpeg.export",
    kind: "render",
    operationId: "render-pending",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-review.mp4",
    sessionId: "current-session",
    startedAt: new Date(2026, 7, 31, 17, 55).toISOString(),
    status: "pending",
    title: "Rendering…",
  },
  {
    id: "current-session:cut-failed:ffmpeg.export",
    kind: "fast-cut",
    operationId: "cut-failed",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-cut.mp4",
    sessionId: "current-session",
    startedAt: new Date(2026, 7, 31, 17, 20).toISOString(),
    status: "failed",
    title: "Fast cut failed",
  },
  {
    action: {
      kind: "open",
      path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-final-optimized.mp4",
    },
    id: "current-session:render-1:ffmpeg.export",
    kind: "render",
    operationId: "render-1",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-final-optimized.mp4",
    sessionId: "current-session",
    startedAt: new Date(2026, 7, 31, 17, 45).toISOString(),
    status: "completed",
    title: "Optimized render completed",
  },
  {
    action: {
      kind: "open",
      path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-fast-cut.mkv",
    },
    id: "current-session:cut-1:ffmpeg.export",
    kind: "fast-cut",
    operationId: "cut-1",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-fast-cut.mkv",
    sessionId: "current-session",
    startedAt: new Date(2026, 7, 31, 16, 50).toISOString(),
    status: "completed",
    title: "Fast cut completed",
  },
  {
    id: "today-session:restore-1:source.file-restore.completed",
    kind: "file-restored",
    path: "C:\\Users\\Editor\\Videos\\Source Footage\\camera-a\\interview-source.mp4",
    sessionId: "today-session",
    startedAt: new Date(2026, 7, 31, 9, 45).toISOString(),
    status: "completed",
    title: "File restored",
  },
  {
    action: {
      kind: "open",
      path: "C:\\Users\\Editor\\Videos\\Client Projects\\Archive\\previous-render.mp4",
    },
    id: "different-version-session:render-2:ffmpeg.export",
    kind: "render",
    operationId: "render-2",
    path: "C:\\Users\\Editor\\Videos\\Client Projects\\Archive\\previous-render.mp4",
    sessionId: "different-version-session",
    startedAt: new Date(2026, 7, 30, 20, 42).toISOString(),
    status: "completed",
    title: "Optimized render completed",
  },
  {
    action: {
      kind: "open",
      path: "C:\\Users\\Editor\\Videos\\Archive\\client-review-cut.mp4",
    },
    id: "retained-session:cut-older:ffmpeg.export",
    kind: "fast-cut",
    operationId: "cut-older",
    path: "C:\\Users\\Editor\\Videos\\Archive\\client-review-cut.mp4",
    sessionId: "retained-session",
    startedAt: new Date(2026, 7, 28, 11, 10).toISOString(),
    status: "completed",
    title: "Fast cut completed",
  },
  {
    id: "retained-session:cut-interrupted:ffmpeg.export",
    kind: "fast-cut",
    operationId: "cut-interrupted",
    path: "C:\\Users\\Editor\\Videos\\Archive\\interrupted-cut.mp4",
    sessionId: "retained-session",
    startedAt: new Date(2026, 7, 28, 11, 45).toISOString(),
    status: "interrupted",
    title: "Fast cut interrupted",
  },
];

const sessions: DiagnosticSessionMetadata[] = [
  {
    appVersion: "1.3.0",
    sessionId: "current-session",
    startedAt: new Date(2026, 7, 31, 16, 30).toISOString(),
  },
  {
    appVersion: "1.3.0",
    sessionId: "today-session",
    startedAt: new Date(2026, 7, 31, 8, 52).toISOString(),
  },
  {
    appVersion: "1.4.2",
    sessionId: "different-version-session",
    startedAt: new Date(2026, 7, 30, 20, 14).toISOString(),
  },
  {
    appVersion: null,
    sessionId: "retained-session",
    startedAt: new Date(2026, 7, 28, 10, 3).toISOString(),
  },
];

const meta = {
  args: {
    currentAppVersion: "1.3.0",
    currentSessionId: "current-session",
    now,
    onAction: () => undefined,
    sessions,
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

export const SessionHierarchy: Story = { args: { entries } };

export const Empty: Story = { args: { entries: [], sessions: [] } };
