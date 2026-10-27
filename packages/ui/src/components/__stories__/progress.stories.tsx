import type { Meta, StoryObj } from "@storybook/react";

import { Progress } from "../progress";

const meta = {
  component: Progress,
  tags: ["autodocs"],
  title: "Design System/Progress",
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { "aria-label": "Export progress", className: "w-72", value: 64 },
};

export const Empty: Story = {
  args: { "aria-label": "Export progress", className: "w-72", value: 0 },
};
