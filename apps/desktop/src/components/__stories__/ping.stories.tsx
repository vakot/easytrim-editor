import type { Meta, StoryObj } from "@storybook/react";
import { Bell } from "lucide-react";

import { Button } from "@easytrim-editor/ui/button";

import { Ping } from "../ping";

const meta = {
  component: Ping,
  tags: ["autodocs"],
  title: "Design System/Ping",
} satisfies Meta<typeof Ping>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Anchors to the top-right corner of the nearest positioned ancestor. */
export const OnSecondaryButton: Story = {
  render: (args) => (
    <Button aria-label="Notifications" className="relative" size="icon-lg" variant="secondary">
      <Bell />
      <Ping {...args} />
    </Button>
  ),
};

export const OnSecondaryButtonWithLabel: Story = {
  render: (args) => (
    <Button className="relative" variant="secondary">
      <Bell /> Notifications
      <Ping {...args} />
    </Button>
  ),
};
