import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "../label";
import { RadioGroup, RadioGroupItem } from "../radio-group";

const meta = {
  component: RadioGroup,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Radio Group",
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup aria-label="Export route" className="w-48" defaultValue="optimized">
      <div className="flex items-center gap-2">
        <RadioGroupItem id="fast-cut" value="fast" />
        <Label htmlFor="fast-cut">Fast cut</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="optimized-render" value="optimized" />
        <Label htmlFor="optimized-render">Optimized render</Label>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup aria-label="Preview size" className="flex w-auto gap-4" defaultValue="medium">
      <div className="flex items-center gap-2">
        <RadioGroupItem id="small" value="small" />
        <Label htmlFor="small">Small</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="medium" value="medium" />
        <Label htmlFor="medium">Medium</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="large" value="large" />
        <Label htmlFor="large">Large</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup aria-label="Audio mode" className="w-48" defaultValue="stereo" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="stereo" value="stereo" />
        <Label htmlFor="stereo">Stereo</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="mono" value="mono" />
        <Label htmlFor="mono">Mono</Label>
      </div>
    </RadioGroup>
  ),
};
