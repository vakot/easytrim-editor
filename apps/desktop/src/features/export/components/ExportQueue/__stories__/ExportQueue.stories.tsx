import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";

import { ExportQueue, ExportQueueActions, ExportQueueContent, ExportQueueSummary } from "../";

import { createStoryStore, type ExportQueueStoryItem } from "./export-queue.stories.fixtures";

const mixedQueue: ExportQueueStoryItem[] = [
  { id: "queued-review", label: "client-review", status: "queued" },
  {
    id: "rendering-highlights",
    label: "travel-highlights-optimized",
    progressPercent: 64,
    route: "optimized",
    status: "rendering",
  },
  {
    id: "completed-cut",
    label: "travel-highlights-cut",
    route: "fast",
    status: "completed",
  },
  {
    id: "failed-preview",
    label: "travel-highlights-preview",
    status: "failed",
  },
  {
    id: "canceled-draft",
    label: "travel-highlights-draft",
    status: "canceled",
  },
];

const longQueue: ExportQueueStoryItem[] = Array.from({ length: 10 }, (_, index) => ({
  capturedAt: index + 1,
  id: `history-${index + 1}`,
  label: `travel-highlights-version-${index + 1}`,
  status: index === 9 ? "rendering" : "completed",
  ...(index === 9 ? { progressPercent: 48 } : {}),
}));

const meta = {
  component: ExportQueue,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Features/Export Queue",
} satisfies Meta<typeof ExportQueue>;

export default meta;

type Story = StoryObj<typeof meta>;

function ExportQueueStory({ items }: { items: ExportQueueStoryItem[] }) {
  const store = createStoryStore(items);

  return (
    <Provider store={store}>
      <ExportQueue>
        <div className="grid w-136 max-w-[calc(100vw-2rem)] gap-3 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <ExportQueueSummary />
            <span className="text-xs">Export history</span>
          </div>
          <div className="max-h-128 overflow-auto rounded-md border p-1">
            <ExportQueueContent />
          </div>
          <ExportQueueActions />
        </div>
      </ExportQueue>
    </Provider>
  );
}

export const Empty: Story = {
  render: () => <ExportQueueStory items={[]} />,
};

export const MixedStatuses: Story = {
  render: () => <ExportQueueStory items={mixedQueue} />,
};

export const LongHistory: Story = {
  render: () => <ExportQueueStory items={longQueue} />,
};
