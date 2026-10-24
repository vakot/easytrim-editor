import type { Meta, StoryObj } from "@storybook/react";

import { TooltipProvider } from "@easytrim-editor/ui/tooltip";

import { Slider } from "../slider";

const meta = {
  component: Slider,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  tags: ["autodocs"],
  title: "Design System/Slider",
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { "aria-label": "Playhead position", className: "w-72", defaultValue: [42] },
};

export const WithMarkers: Story = {
  args: {
    "aria-label": "Playhead position",
    className: "w-72",
    defaultValue: [30],
    markers: [
      { label: "Start", value: 0 },
      { label: "Middle", value: 50 },
      { label: "End", value: 100 },
    ],
  },
};
