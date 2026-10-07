import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportStarted,
} from "@/app/store/slices/editing-instances-slice";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { ExportActions } from "../ExportActions";
import { createStoryStore } from "../ExportQueue/__stories__/export-queue.stories.fixtures";

const meta = {
  component: ExportActions,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Features/Export Actions",
} satisfies Meta<typeof ExportActions>;

export default meta;

type Story = StoryObj<typeof meta>;

function ExportActionsQueuePulseStory() {
  const [store] = useState(() => createStoryStore([]));
  const [nextAttemptNumber, setNextAttemptNumber] = useState(1);
  const [latestAttempt, setLatestAttempt] = useState<{ id: string; pending: boolean } | null>(null);

  const queueExampleExport = () => {
    const attemptNumber = nextAttemptNumber;
    const attemptId = `story-attempt-${attemptNumber}`;
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      capturedAt: Date.now(),
      id: attemptId,
      output: {
        displayName: `story-export-${attemptNumber}.mp4`,
        displayPath: `C:/Exports/story-export-${attemptNumber}.mp4`,
        outputId: `story-output-${attemptNumber}`,
      },
      request: {
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
        sourcePath: firstSource.sourcePath,
        trim: { endMicros: 1_000_000, startMicros: 0 },
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(editingInstanceExportAttemptQueued({ attempt, id: "story-source" }));
    setLatestAttempt({ id: attemptId, pending: true });
    setNextAttemptNumber((number) => number + 1);
  };

  const settleLatestAttempt = (outcome: "completed" | "failed") => {
    if (!latestAttempt?.pending) return;

    const operationId = `operation-${latestAttempt.id}`;
    store.dispatch(
      editingInstanceExportStarted({
        attemptId: latestAttempt.id,
        id: "story-source",
        startedAt: Date.now(),
      }),
    );

    if (outcome === "completed") {
      store.dispatch(
        editingInstanceExportCompleted({
          attemptId: latestAttempt.id,
          durationMs: 1_200,
          id: "story-source",
          result: {
            displayName: `story-export-${nextAttemptNumber - 1}.mp4`,
            displayPath: `C:/Exports/story-export-${nextAttemptNumber - 1}.mp4`,
            operationId,
          },
        }),
      );
    } else {
      store.dispatch(
        editingInstanceExportFailed({
          attemptId: latestAttempt.id,
          durationMs: 1_200,
          error: {
            code: "render-failed",
            messageId: "export.ffmpegCouldNotRenderTheSelectedSegment",
          },
          id: "story-source",
        }),
      );
    }

    setLatestAttempt({ ...latestAttempt, pending: false });
  };

  return (
    <Provider store={store}>
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
          <ExportActions />
          <Button onClick={queueExampleExport} type="button" variant="outline">
            Queue example export
          </Button>
          <Button
            disabled={!latestAttempt?.pending}
            onClick={() => settleLatestAttempt("completed")}
            type="button"
            variant="success"
          >
            Complete latest
          </Button>
          <Button
            disabled={!latestAttempt?.pending}
            onClick={() => settleLatestAttempt("failed")}
            type="button"
            variant="destructive"
          >
            Fail latest
          </Button>
        </div>
      </TooltipProvider>
    </Provider>
  );
}

export const QueuePulse: Story = {
  render: () => <ExportActionsQueuePulseStory />,
};
