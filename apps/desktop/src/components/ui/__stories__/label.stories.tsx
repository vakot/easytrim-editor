import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "../input";
import { Label } from "../label";

const meta = {
  component: Label,
  tags: ["autodocs"],
  title: "Design System/Label",
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="project-name">Project name</Label>
      <Input defaultValue="My project" id="project-name" />
    </div>
  ),
};
