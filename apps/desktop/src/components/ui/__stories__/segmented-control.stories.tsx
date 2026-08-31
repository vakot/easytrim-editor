import type { Meta, StoryObj } from "@storybook/react";
import { Trash, X } from "lucide-react";
import * as React from "react";

import { SegmentedControl, SegmentedControlItem } from "../segmented-control";

const meta = {
  component: SegmentedControl,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Segmented Control",
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SegmentedControl aria-label="Report type" defaultValue="archive">
      <SegmentedControlItem value="archive">Archive</SegmentedControlItem>
      <SegmentedControlItem value="report">Report</SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const Controlled: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("archive");

    return (
      <div className="flex flex-col items-center gap-3">
        <SegmentedControl aria-label="Report type" onValueChange={setValue} value={value}>
          <SegmentedControlItem value="archive">Archive</SegmentedControlItem>
          <SegmentedControlItem value="report">Report</SegmentedControlItem>
        </SegmentedControl>
        <p className="text-sm text-muted-foreground">Selected: {value}</p>
      </div>
    );
  },
};

export const ThreeOptions: Story = {
  render: () => (
    <SegmentedControl aria-label="Time range" defaultValue="day">
      <SegmentedControlItem size="lg" value="day" variant="success">
        Day
      </SegmentedControlItem>
      <SegmentedControlItem size="lg" value="week">
        Week
      </SegmentedControlItem>
      <SegmentedControlItem size="lg" value="month" variant="destructive">
        Month
      </SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const Icons: Story = {
  render: () => (
    <SegmentedControl defaultValue="close">
      <SegmentedControlItem size="icon-lg" value="close" variant="destructive">
        <X aria-hidden="true" />
      </SegmentedControlItem>
      <SegmentedControlItem size="icon-lg" value="delete" variant="destructive">
        <Trash aria-hidden="true" />
      </SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const DisabledItem: Story = {
  render: () => (
    <SegmentedControl aria-label="Report type with unavailable option" defaultValue="archive">
      <SegmentedControlItem value="archive">Archive</SegmentedControlItem>
      <SegmentedControlItem disabled value="report">
        Report
      </SegmentedControlItem>
      <SegmentedControlItem value="summary">Summary</SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const DisabledGroup: Story = {
  render: () => (
    <SegmentedControl aria-label="Unavailable report type" defaultValue="archive" disabled>
      <SegmentedControlItem value="archive">Archive</SegmentedControlItem>
      <SegmentedControlItem value="report">Report</SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const EqualWidth: Story = {
  render: () => (
    <SegmentedControl aria-label="Report type with equal widths" defaultValue="archive">
      <SegmentedControlItem className="min-w-24" value="archive">
        Archive
      </SegmentedControlItem>
      <SegmentedControlItem className="min-w-24" value="report">
        Report
      </SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const KeyboardNavigation: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-3">
      <SegmentedControl aria-label="Keyboard-selectable report type" defaultValue="archive">
        <SegmentedControlItem autoFocus value="archive">
          Archive
        </SegmentedControlItem>
        <SegmentedControlItem value="report">Report</SegmentedControlItem>
      </SegmentedControl>
      <p className="text-sm text-muted-foreground">
        Focus starts on Archive; use Arrow keys to move and select.
      </p>
    </div>
  ),
};
