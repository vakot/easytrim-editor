import type { Meta, StoryObj } from "@storybook/react";

import { Kbd, KbdGroup } from "../kbd";

const meta = {
  component: Kbd,
  tags: ["autodocs"],
  title: "Design System/Keyboard Hint",
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <span className="text-sm">Save project</span>
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>S</Kbd>
      </KbdGroup>
    </div>
  ),
};
