import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Card } from "@/components/ui/card";

import { InfiniteScroll } from "../infinite-scroll";

const meta = {
  component: InfiniteScroll,
  tags: ["autodocs"],
  title: "Components/Infinite Scroll",
} satisfies Meta<typeof InfiniteScroll>;

export default meta;

type Story = StoryObj<typeof meta>;

function InfiniteScrollDemo() {
  const [itemCount, setItemCount] = useState(10);

  return (
    <Card className="h-64 w-80 p-2">
      <InfiniteScroll
        className="h-full overflow-y-auto"
        hasMore={itemCount < 30}
        onLoadMore={() => setItemCount((count) => Math.min(count + 10, 30))}
      >
        <div className="flex flex-col gap-2">
          {Array.from({ length: itemCount }, (_, index) => (
            <div className="rounded-md bg-muted/50 p-2" key={index}>
              Item {index + 1}
            </div>
          ))}
        </div>
      </InfiniteScroll>
    </Card>
  );
}

export const Default: Story = {
  args: {
    hasMore: true,
    onLoadMore: () => undefined,
  },
  render: () => <InfiniteScrollDemo />,
};
