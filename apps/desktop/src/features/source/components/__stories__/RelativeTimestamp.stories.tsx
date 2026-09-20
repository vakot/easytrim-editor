import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { RelativeTimestamp } from "../RelativeTimestamp";

const meta = {
  args: {
    className: "text-sm text-muted-foreground",
    label: "Updated at",
    unknownLabel: "Unknown",
  },
  component: RelativeTimestamp,
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
  title: "Source/Relative Timestamp",
} satisfies Meta<typeof RelativeTimestamp>;

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
  args: { timestampMicros: timestampFromNow(0) },
};

export const Seconds: Story = {
  args: { timestampMicros: timestampFromNow(5_000) },
};

export const Minutes: Story = {
  args: { timestampMicros: timestampFromNow(5 * 60_000) },
};

export const Hours: Story = {
  args: { timestampMicros: timestampFromNow(5 * 60 * 60_000) },
};

export const Yesterday: Story = {
  args: { timestampMicros: yesterday.getTime() * 1_000 },
};

export const Earlier: Story = {
  args: { timestampMicros: earlier.getTime() * 1_000 },
};

export const Unknown: Story = {
  args: { timestampMicros: undefined },
};
