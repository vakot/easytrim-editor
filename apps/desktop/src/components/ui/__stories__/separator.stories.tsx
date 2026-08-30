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
  render: (args) => (
    <div className="w-72">
      <Separator {...args} />
    </div>
  ),
};

export const Vertical: Story = {
  args: { className: "h-8", orientation: "vertical" },
};
