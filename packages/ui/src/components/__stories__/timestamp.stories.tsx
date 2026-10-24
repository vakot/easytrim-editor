import type { Meta, StoryObj } from "@storybook/react";

import { Timestamp } from "../timestamp";
import { TooltipProvider } from "../tooltip";

const meta = {
  args: {
    className: "text-sm text-muted-foreground",
    locale: "en",
    unknownLabel: "Unknown",
  },
  component: Timestamp,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="w-48">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Timestamp",
} satisfies Meta<typeof Timestamp>;

export default meta;

type Story = StoryObj<typeof meta>;

const storyNow = Date.now();

function timestampFromNow(milliseconds: number): number {
  return (storyNow - milliseconds) * 1_000;
}

const yesterday = new Date(storyNow);
yesterday.setDate(yesterday.getDate() - 1);
const earlier = new Date(storyNow);
earlier.setDate(earlier.getDate() - 2);

export const JustNow: Story = {
  args: { label: "Updated at", timestamp: timestampFromNow(0) },
};

export const Seconds: Story = {
  args: { label: "Updated at", timestamp: timestampFromNow(5_000) },
};

export const Minutes: Story = {
  args: { label: "Updated at", timestamp: timestampFromNow(5 * 60_000) },
};

export const Hours: Story = {
  args: { label: "Updated at", timestamp: timestampFromNow(5 * 60 * 60_000) },
};

export const Yesterday: Story = {
  args: { label: "Updated at", timestamp: yesterday.getTime() * 1_000 },
};

export const Earlier: Story = {
  args: { label: "Updated at", timestamp: earlier.getTime() * 1_000 },
};

export const Unknown: Story = {
  args: { label: "Updated at", timestamp: undefined },
};
