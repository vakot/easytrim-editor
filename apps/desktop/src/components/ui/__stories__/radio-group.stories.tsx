import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "../button";
import { ButtonGroup } from "../button-group";
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

export const SegmentedControlled: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("archive");

    return (
      <RadioGroup
        aria-label="Report type"
        className="flex w-auto gap-0"
        onValueChange={setValue}
        value={value}
      >
        <ButtonGroup>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="archive"
            >
              Archive
            </RadioGroupItem>
          </Button>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="report"
            >
              Report
            </RadioGroupItem>
          </Button>
        </ButtonGroup>
      </RadioGroup>
    );
  },
};

export const SegmentedThreeOptions: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("day");

    return (
      <RadioGroup
        aria-label="Time range"
        className="flex w-auto gap-0"
        onValueChange={setValue}
        value={value}
      >
        <ButtonGroup>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-20 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="day"
            >
              Day
            </RadioGroupItem>
          </Button>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-20 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="week"
            >
              Week
            </RadioGroupItem>
          </Button>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-20 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="month"
            >
              Month
            </RadioGroupItem>
          </Button>
        </ButtonGroup>
      </RadioGroup>
    );
  },
};

export const SegmentedKeyboardNavigation: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("archive");

    return (
      <div className="flex flex-col items-center gap-3">
        <RadioGroup
          aria-label="Keyboard-selectable report type"
          className="flex w-auto gap-0"
          onValueChange={setValue}
          value={value}
        >
          <ButtonGroup>
            <Button asChild variant="outline">
              <RadioGroupItem
                autoFocus
                className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
                value="archive"
              >
                Archive
              </RadioGroupItem>
            </Button>
            <Button asChild variant="outline">
              <RadioGroupItem
                className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
                value="report"
              >
                Report
              </RadioGroupItem>
            </Button>
          </ButtonGroup>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          Focus starts on Archive; use Arrow keys to move.
        </p>
      </div>
    );
  },
};

export const SegmentedWithDisabledOption: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("archive");

    return (
      <RadioGroup
        aria-label="Report type with unavailable option"
        className="flex w-auto gap-0"
        onValueChange={setValue}
        value={value}
      >
        <ButtonGroup>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="archive"
            >
              Archive
            </RadioGroupItem>
          </Button>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              disabled
              value="report"
            >
              Report
            </RadioGroupItem>
          </Button>
          <Button asChild variant="outline">
            <RadioGroupItem
              className="h-9 min-w-24 rounded-lg *:data-[slot=radio-group-indicator]:hidden"
              value="summary"
            >
              Summary
            </RadioGroupItem>
          </Button>
        </ButtonGroup>
      </RadioGroup>
    );
  },
};
