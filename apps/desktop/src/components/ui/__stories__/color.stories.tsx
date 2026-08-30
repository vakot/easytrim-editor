import type { Meta, StoryObj } from "@storybook/react";

import { ColorSample, SpectrumWheel } from "../color";

const meta = {
  component: ColorSample,
  tags: ["autodocs"],
  title: "Design System/Color",
} satisfies Meta<typeof ColorSample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sample: Story = {
  args: { color: "#f59e0b", "aria-label": "Amber" },
};

export const Spectrum: Story = {
  args: { color: "#f59e0b" },
  render: () => <SpectrumWheel aria-label="Choose a color" color="#f59e0b" />,
};
