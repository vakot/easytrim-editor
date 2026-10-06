import type { Meta, StoryObj } from "@storybook/react";

import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerInput,
  ColorPickerSaturationValue,
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
        <ColorPickerSpectrum aria-label="Choose a color">
          <ColorPickerSaturationValue aria-label="Saturation and brightness" />
          <ColorPickerHue aria-label="Hue" />
        </ColorPickerSpectrum>
        <ColorPickerInput aria-label="HEX color" />
      </div>
    </ColorPicker>
  ),
};
