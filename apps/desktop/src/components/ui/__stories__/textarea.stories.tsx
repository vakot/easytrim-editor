import type { Meta, StoryObj } from "@storybook/react";

import { Textarea } from "../textarea";

const meta = {
  component: Textarea,
  tags: ["autodocs"],
  title: "Design System/Textarea",
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: "w-96",
    placeholder: "Add notes about this edit",
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    className: "w-96",
    defaultValue: "This value needs attention.",
  },
};
