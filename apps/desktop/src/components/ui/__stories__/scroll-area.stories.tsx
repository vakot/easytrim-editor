import type { Meta, StoryObj } from "@storybook/react";

import { ScrollArea } from "../scroll-area";

const meta = {
  component: ScrollArea,
  tags: ["autodocs"],
  title: "Design System/Scroll Area",
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-48 w-72 rounded-md border p-4">
      <div className="grid gap-3 pr-3 text-sm">
        {Array.from({ length: 12 }, (_, index) => (
          <div className="rounded-md bg-muted/50 p-2" key={index}>
            Timeline marker {index + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
