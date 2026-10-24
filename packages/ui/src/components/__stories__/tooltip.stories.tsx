import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

const meta = {
  component: Tooltip,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Tooltip",
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline">Preview</Button>
        </TooltipTrigger>
        <TooltipContent>Preview the current frame</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
