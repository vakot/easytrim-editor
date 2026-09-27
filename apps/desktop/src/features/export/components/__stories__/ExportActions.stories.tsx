import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstanceExportAttemptQueued } from "@/app/store/slices/editing-instances-slice";
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

  const queueExampleExport = () => {
    const attemptNumber = nextAttemptNumber;
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      capturedAt: Date.now(),
      id: `story-attempt-${attemptNumber}`,
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
    setNextAttemptNumber((number) => number + 1);
  };

  return (
    <Provider store={store}>
      <TooltipProvider>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <ExportActions />
          <Button onClick={queueExampleExport} type="button" variant="outline">
            Queue example export
          </Button>
        </div>
      </TooltipProvider>
    </Provider>
  );
}

export const QueuePulse: Story = {
  render: () => <ExportActionsQueuePulseStory />,
};
