import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

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

export const Missing: Story = {
  args: { source: missingSource } satisfies SourceCardProps,
};

export const Deleted: Story = {
  args: { source: deletedSource } satisfies SourceCardProps,
};
