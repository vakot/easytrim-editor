import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import { Provider } from "react-redux";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { importedThumbnailReady } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";

import { ExportQueueWidget } from "../ExportQueueWidget";

const thumbnailUrls = {
  blue: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'%3E%3Crect width='160' height='90' fill='%231e3a5f'/%3E%3Ccircle cx='126' cy='30' r='22' fill='%2360a5fa'/%3E%3Cpath d='m0 78 44-28 28 18 28-23 60 43H0Z' fill='%2393c5fd'/%3E%3C/svg%3E",
  orange:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'%3E%3Crect width='160' height='90' fill='%237c2d12'/%3E%3Ccircle cx='34' cy='28' r='18' fill='%23fdba74'/%3E%3Cpath d='m0 82 48-36 28 20 24-18 60 34H0Z' fill='%23fb923c'/%3E%3C/svg%3E",
} as const;

type ExportQueueStoryArgs = ComponentProps<typeof ExportQueueWidget> & {
  pendingCount: number;
};

const meta = {
  component: ExportQueueWidget,
  decorators: [
    (Story) => (
      <Provider store={createAppStore()}>
        <Story />
      </Provider>
    ),
  ],
  argTypes: {
    layout: {
      control: "inline-radio",
      description: "Arrange the featured export and pending items horizontally or vertically.",
      options: ["horizontal", "vertical"],
    },
    pendingCount: {
      control: { max: 8, min: 0, step: 1, type: "number" },
      description: "Number of queued exports used by this Storybook fixture.",
    },
  },
  args: { layout: "vertical", pendingCount: 2 },
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Features/Export Queue Widget",
} satisfies Meta<ExportQueueStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

function createSource(id: string, displayName: string): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(
      { displayName, sourcePath: `C:/Media/${displayName}` },
      false,
    ),
    sourceAvailability: "available",
  };
}

function createAttempt(id: string, source: EditingInstance, capturedAt: number) {
  return createExportAttempt({
    capturedAt,
    id,
    output: {
      displayName: `${id}.mp4`,
      displayPath: `C:/Exports/${id}.mp4`,
      outputId: `output-${id}`,
    },
    request: {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0,
      sourcePath: source.snapshot.source.sourcePath,
      trim: { endMicros: 12_000_000, startMicros: 0 },
    },
    route: "optimized",
    snapshot: source.snapshot,
    totalFrames: 288,
  });
}

function createQueueStore({
  pendingCount,
  rendering,
}: {
  pendingCount: number;
  rendering: boolean;
}) {
  const store = createAppStore();
  const normalizedPendingCount = Math.max(0, Math.min(8, Math.round(pendingCount)));
  const sourceNames = [
    "summer-campaign.mp4",
    "interview-selects.mov",
    "product-b-roll.webm",
    "voiceover-take.wav",
    "social-cut.mp4",
    "conference-b-roll.mov",
    "customer-story.webm",
    "launch-teaser.mp4",
  ];

  const sourceCount = normalizedPendingCount + (rendering ? 1 : 0);
  const sources = Array.from({ length: sourceCount }, (_, index) =>
    createSource(`source-${index + 1}`, sourceNames[index] ?? `queued-export-${index + 1}.mp4`),
  );

  store.dispatch(editingInstancesAdded(sources));
  sources.forEach((source, index) => {
    store.dispatch(
      editingInstanceExportAttemptQueued({
        id: source.id,
        attempt: createAttempt(`export-${index + 1}`, source, index + 1),
      }),
    );
    store.dispatch(
      importedThumbnailReady({
        instanceId: source.id,
        thumbnail: {
          mediaToken: index + 1,
          url: index % 2 === 0 ? thumbnailUrls.blue : thumbnailUrls.orange,
        },
      }),
    );
  });

  const renderingSource = sources[0];
  if (rendering && renderingSource) {
    store.dispatch(
      editingInstanceExportStarted({
        attemptId: "export-1",
        id: renderingSource.id,
        startedAt: 100,
      }),
    );
    store.dispatch(
      editingInstanceExportProgressReceived({
        attemptId: "export-1",
        id: renderingSource.id,
        metrics: { progressPercent: 64, currentFrame: 184, fps: 29.97 },
        progress: {
          elapsedMicros: 7_680_000,
          frame: 184,
          operationId: "operation-1",
          phase: "running",
          speed: "1.2x",
        },
      }),
    );
  }

  return store;
}

export const ActiveWithPending: Story = {
  args: {
    pendingCount: 8,
    className: "w-96",
    layout: "horizontal",
  },

  render: ({ pendingCount, ...args }) => (
    <Provider store={createQueueStore({ pendingCount, rendering: true })}>
      <ExportQueueWidget {...args} />
    </Provider>
  ),
};

export const WidthControlled: Story = {
  args: {
    className: "w-full",
    layout: "horizontal",
    pendingCount: 8,
  },
  render: ({ pendingCount, ...args }) => (
    <Provider store={createQueueStore({ pendingCount, rendering: true })}>
      <ExportQueueWidget {...args} />
    </Provider>
  ),
};

export const PendingOnly: Story = {
  render: ({ pendingCount, ...args }) => (
    <Provider store={createQueueStore({ pendingCount, rendering: false })}>
      <ExportQueueWidget {...args} />
    </Provider>
  ),
};
