import type { Meta, StoryObj } from "@storybook/react";

import {
  ColorPicker,
  ColorPickerInput,
  ColorPickerSpectrum,
  ColorSample,
} from "@/components/color";

const meta = {
  component: ColorSample,
  tags: ["autodocs"],
  title: "Design System/Color",
} satisfies Meta<typeof ColorSample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sample: Story = {
  args: { color: "#f59e0b", "aria-label": "Amber", className: "block size-5" },
};

export const Spectrum: Story = {
  args: { color: "#f59e0b" },
  render: () => (
    <ColorPicker defaultValue="#f59e0b">
      <div className="w-72 space-y-3">
        <ColorPickerSpectrum aria-label="Choose a color" />
        <ColorPickerInput aria-label="HEX color" />
      </div>
    </ColorPicker>
  ),
};
