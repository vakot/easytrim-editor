import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { CursorTooltip } from "../cursor-tooltip";

const meta = {
  component: CursorTooltip,
  tags: ["autodocs"],
  title: "Design System/Cursor Tooltip",
} satisfies Meta<typeof CursorTooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { tooltipContent: "This tooltip follows the cursor" },
  render: () => (
    <CursorTooltip tooltipContent="This tooltip follows the cursor">
      <Button variant="outline">Move over me</Button>
    </CursorTooltip>
  ),
};
