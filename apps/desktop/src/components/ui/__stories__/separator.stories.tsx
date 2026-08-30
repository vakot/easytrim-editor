import type { Meta, StoryObj } from "@storybook/react";

import { Separator } from "../separator";

const meta = {
  component: Separator,
  tags: ["autodocs"],
  title: "Design System/Separator",
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { className: "w-72" },
};

export const Vertical: Story = {
  args: { className: "h-8", orientation: "vertical" },
};
