import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Film } from "lucide-react";
import { Provider } from "react-redux";

import { Card } from "@/components/ui/card";

import {
  createStoryStore,
  type ExportQueueStoryStatus,
} from "../../ExportQueue/__stories__/export-queue.stories.fixtures";
import {
  ExportQueueItem,
  ExportQueueItemCancel,
  ExportQueueItemContent,
  ExportQueueItemMetrics,
  ExportQueueItemOutputName,
  ExportQueueItemProgressBar,
  ExportQueueItemProgressPercent,
  ExportQueueItemRestore,
  ExportQueueItemRetry,
  ExportQueueItemReveal,
  ExportQueueItemRoute,
  ExportQueueItemSourceName,
  ExportQueueItemStatus,
  useExportQueueItem,
} from "../";

const meta = {
  component: ExportQueueItem,
  args: { attemptId: "story-queued", children: null, instanceId: "story-source" },
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Features/Export Queue Item",
} satisfies Meta<typeof ExportQueueItem>;

export default meta;

type Story = StoryObj<typeof meta>;

function ExportQueueItemStory({ status }: { status: ExportQueueStoryStatus }) {
  const store = createStoryStore([
    {
      id: `story-${status}`,
      label: `travel-highlights-${status}`,
      progressPercent: status === "rendering" ? 64 : undefined,
      route: status === "rendering" ? "optimized" : "fast",
      status,
    },
  ]);

  return (
    <Provider store={store}>
      <ExportQueueItem attemptId={`story-${status}`} instanceId="story-source">
        <ExportQueueItemView />
      </ExportQueueItem>
    </Provider>
  );
}

function ExportQueueItemView() {
  const { attempt } = useExportQueueItem();
  const status = attempt.state.status;

  return (
    <ExportQueueItemContent className="w-100 max-w-[calc(100vw-2rem)] rounded-lg border bg-card text-xs">
      <Card className="size-10 shrink-0 items-center justify-center bg-primary/5 p-0 ring-primary/10">
        <Film className="size-6 text-muted-foreground" />
      </Card>

      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex justify-between gap-2">
          <div className="grid min-w-0 gap-1">
            <ExportQueueItemOutputName />
            <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <ExportQueueItemSourceName className="min-w-0" />
              ·
              <ExportQueueItemRoute className="shrink-0" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ExportQueueItemStatus />
            <ExportQueueItemCancel />
            <ExportQueueItemRestore />
          </div>
        </div>

        {status === "rendering" && <ExportQueueItemProgressBar />}

        <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <ExportQueueItemProgressPercent />
          <ExportQueueItemMetrics />
        </div>

        {status === "completed" || status === "failed" ? (
          <div className="flex gap-1">
            <ExportQueueItemReveal />
            <ExportQueueItemRetry />
          </div>
        ) : null}
      </div>
    </ExportQueueItemContent>
  );
}

export const Queued: Story = {
  render: () => <ExportQueueItemStory status="queued" />,
};

export const Rendering: Story = {
  render: () => <ExportQueueItemStory status="rendering" />,
};

export const Completed: Story = {
  render: () => <ExportQueueItemStory status="completed" />,
};

export const Failed: Story = {
  render: () => <ExportQueueItemStory status="failed" />,
};

export const Canceled: Story = {
  render: () => <ExportQueueItemStory status="canceled" />,
};
