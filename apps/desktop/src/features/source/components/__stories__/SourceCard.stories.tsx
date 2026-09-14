import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance, ExportAttempt } from "@/domain/editing-instance";

import { SourceCard, type SourceCardProps } from "../SourceCard";

const meta = {
  component: SourceCard,
  decorators: [
    (Story) => (
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <div className="w-72">
            <Story />
          </div>
        </TooltipProvider>
      </Provider>
    ),
  ],
  tags: ["autodocs"],
  title: "Source/Source Card",
} satisfies Meta<typeof SourceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseSource: EditingInstance = {
  exportAttempts: [],
  id: "source-1",
  origin: "source-import",
  snapshot: createDefaultEditorSnapshot(
    {
      displayName: "travel-highlights.mp4",
      sourcePath: "C:/Media/2026/travel-highlights.mp4",
    },
    false,
  ),
  sourceAvailability: "available",
};

function createAttempt(state: ExportAttempt["state"]): ExportAttempt {
  return {
    capturedAt: 1,
    id: "attempt-1",
    metrics: { durationMs: 100, progressPercent: state.status === "completed" ? 100 : 42 },
    output: {
      displayName: "travel-highlights-export.mp4",
      displayPath: "C:/Media/2026/travel-highlights-export.mp4",
      outputId: "output-1",
    },
    request: {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0,
      sourcePath: baseSource.snapshot.source.sourcePath,
      trim: { endMicros: 60_000_000, startMicros: 0 },
    },
    route: "fast",
    snapshot: baseSource.snapshot,
    state,
  };
}

const completedSource: EditingInstance = {
  ...baseSource,
  id: "source-completed",
  exportAttempts: [
    createAttempt({
      completedAt: 2,
      result: {
        displayName: "travel-highlights-export.mp4",
        displayPath: "C:/Media/2026/travel-highlights-export.mp4",
        operationId: "operation-1",
      },
      status: "completed",
    }),
  ],
};

const renderingSource: EditingInstance = {
  ...baseSource,
  id: "source-rendering",
  exportAttempts: [
    createAttempt({ operationId: "operation-1", startedAt: 2, status: "rendering" }),
  ],
};

const failedSource: EditingInstance = {
  ...baseSource,
  id: "source-failed",
  exportAttempts: [
    createAttempt({
      error: { code: "export_failed", message: "The export failed." },
      failedAt: 2,
      status: "failed",
    }),
  ],
};

const missingSource: EditingInstance = {
  ...baseSource,
  id: "source-missing",
  sourceAvailability: "missing",
};

const deletedSource: EditingInstance = {
  ...baseSource,
  id: "source-deleted",
  sourceAvailability: "deleted",
};

export const Ready: Story = { args: { source: baseSource } satisfies SourceCardProps };

export const Rendering: Story = {
  args: { source: renderingSource } satisfies SourceCardProps,
};

export const Failed: Story = {
  args: { source: failedSource } satisfies SourceCardProps,
};

export const Completed: Story = {
  args: { source: completedSource } satisfies SourceCardProps,
};

export const Missing: Story = {
  args: { source: missingSource } satisfies SourceCardProps,
};

export const Deleted: Story = {
  args: { source: deletedSource } satisfies SourceCardProps,
};
