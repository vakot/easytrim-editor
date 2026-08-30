import type { Meta, StoryObj } from "@storybook/react";

import { Card } from "@/components/ui/card";

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
      <Card className="flex items-center justify-center" style={{ width: 480, height: 270 }}>
        Move over here
      </Card>
    </CursorTooltip>
  ),
};
