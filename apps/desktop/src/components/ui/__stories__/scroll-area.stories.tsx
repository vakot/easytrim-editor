import type { Meta, StoryObj } from "@storybook/react";

import { Card } from "@/components/ui/card";

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
    <Card className="h-42 w-64">
      <ScrollArea className="h-full px-2">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 12 }, (_, index) => (
            <div className="rounded-md bg-muted/50 p-2" key={index}>
              Timeline marker {index + 1}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  ),
};
