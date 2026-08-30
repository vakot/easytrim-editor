import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

const meta = {
  component: Popover,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Popover",
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="font-medium">Playback speed</p>
        <p className="mt-1 text-muted-foreground">Adjust the preview playback speed.</p>
      </PopoverContent>
    </Popover>
  ),
};
