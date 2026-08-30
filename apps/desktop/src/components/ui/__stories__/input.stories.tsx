import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "../input";

const meta = {
  component: Input,
  tags: ["autodocs"],
  title: "Design System/Input",
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter a project name" },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "Unsupported file", placeholder: "Project name" },
};

export const Disabled: Story = {
  args: { defaultValue: "Read-only value", disabled: true },
};
