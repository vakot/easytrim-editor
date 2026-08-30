import type { Meta, StoryObj } from "@storybook/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../select";

const meta = {
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Select",
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="balanced">
      <SelectTrigger aria-label="Export quality" className="w-48">
        <SelectValue placeholder="Choose quality" />
      </SelectTrigger>
      <SelectContent>
        <SelectLabel>Quality</SelectLabel>
        <SelectItem value="fast">Fast</SelectItem>
        <SelectItem value="balanced">Balanced</SelectItem>
        <SelectSeparator />
        <SelectItem value="high">High quality</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Primary: Story = {
  render: () => (
    <Select defaultValue="export">
      <SelectTrigger aria-label="Action" variant="primary">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="export">Export</SelectItem>
        <SelectItem value="share">Share</SelectItem>
      </SelectContent>
    </Select>
  ),
};
