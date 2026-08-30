import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "../checkbox";

const meta = {
  component: Checkbox,
  tags: ["autodocs"],
  title: "Design System/Checkbox",
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { "aria-label": "Include audio" },
};

export const Checked: Story = {
  args: { "aria-label": "Include subtitles", defaultChecked: true },
};

export const Disabled: Story = {
  args: { "aria-label": "Include metadata", defaultChecked: true, disabled: true },
};
