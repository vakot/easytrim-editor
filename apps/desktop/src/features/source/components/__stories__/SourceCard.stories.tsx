import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import {
  SourceCard,
  SourceCardDescription,
  SourceCardMetadata,
  type SourceCardProps,
  SourceCardStatusBadge,
  SourceCardTitle,
} from "../SourceCard";

const meta = {
  component: SourceCard,
  decorators: [
    (Story) => (
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <div className="w-72">
            <Story />
          </div>
        </TooltipProvider>
      </Provider>
    ),
  ],
  tags: ["autodocs"],
  title: "Source/Source Card",
} satisfies Meta<typeof SourceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseSource: EditingInstance = {
  exportAttempts: [],
  id: "source-1",
  origin: "source-import",
  snapshot: createDefaultEditorSnapshot(
    {
      displayName: "travel-highlights.mp4",
      sourcePath: "C:/Media/2026/travel-highlights.mp4",
    },
    false,
  ),
  sourceAvailability: "available",
};

function sourceUpdatedAt(id: string, updatedAt: number): EditingInstance {
  return {
    ...baseSource,
    id,
    snapshot: {
      ...baseSource.snapshot,
      source: {
        ...baseSource.snapshot.source,
        displayName: `${id}.mp4`,
        updatedAtMicros: updatedAt,
      },
    },
  };
}

const storyNow = Date.now();
const secondsAgo = sourceUpdatedAt("updated-seconds-ago", (storyNow - 5_000) * 1_000);
const secondsBoundary = sourceUpdatedAt("updated-59-seconds-ago", (storyNow - 59_000) * 1_000);
const minutesAgo = sourceUpdatedAt("updated-minutes-ago", (storyNow - 5 * 60_000) * 1_000);
const minutesBoundary = sourceUpdatedAt("updated-59-minutes-ago", (storyNow - 59 * 60_000) * 1_000);
const hoursAgo = sourceUpdatedAt("updated-hours-ago", (storyNow - 5 * 60 * 60_000) * 1_000);
const hoursBoundary = sourceUpdatedAt(
  "updated-23-hours-ago",
  (storyNow - 23 * 60 * 60_000) * 1_000,
);

const yesterday = new Date(storyNow);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdaySource = sourceUpdatedAt("updated-yesterday", yesterday.getTime() * 1_000);
const older = new Date(storyNow);
older.setDate(older.getDate() - 2);
const olderSource = sourceUpdatedAt("updated-older", older.getTime() * 1_000);

const missingSource: EditingInstance = {
  ...baseSource,
  id: "source-missing",
  sourceAvailability: "missing",
};

const deletedSource: EditingInstance = {
  ...baseSource,
  id: "source-deleted",
  sourceAvailability: "deleted",
};

const children = (
  <>
    <div className="flex flex-col gap-1 p-3">
      <SourceCardTitle />
      <SourceCardDescription />
      <SourceCardMetadata />
    </div>
    <SourceCardStatusBadge className="absolute top-2 right-2" />
  </>
);

export const Ready: Story = {
  args: { children, source: baseSource } satisfies SourceCardProps,
};

export const Missing: Story = {
  args: { children, source: missingSource } satisfies SourceCardProps,
};

export const Deleted: Story = {
  args: { children, source: deletedSource } satisfies SourceCardProps,
};

export const UpdatedSecondsAgo: Story = {
  args: { children, source: secondsAgo } satisfies SourceCardProps,
};

export const Updated59SecondsAgo: Story = {
  args: { children, source: secondsBoundary } satisfies SourceCardProps,
};

export const UpdatedMinutesAgo: Story = {
  args: { children, source: minutesAgo } satisfies SourceCardProps,
};

export const Updated59MinutesAgo: Story = {
  args: { children, source: minutesBoundary } satisfies SourceCardProps,
};

export const UpdatedHoursAgo: Story = {
  args: { children, source: hoursAgo } satisfies SourceCardProps,
};

export const Updated23HoursAgo: Story = {
  args: { children, source: hoursBoundary } satisfies SourceCardProps,
};

export const UpdatedYesterday: Story = {
  args: { children, source: yesterdaySource } satisfies SourceCardProps,
};

export const UpdatedEarlier: Story = {
  args: { children, source: olderSource } satisfies SourceCardProps,
};
