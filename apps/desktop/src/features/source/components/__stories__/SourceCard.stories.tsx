import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import {
  SourceCard,
  SourceCardDescription,
  SourceCardMetadata,
  type SourceCardProps,
  SourceCardStatusBadge,
  SourceCardTitle,
} from "../SourceCard";

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

const children = (
  <>
    <div className="flex flex-col gap-1 p-3">
      <SourceCardTitle />
      <SourceCardDescription />
      <SourceCardMetadata />
    </div>
    <SourceCardStatusBadge className="absolute top-2 right-2" />
  </>
);

export const Ready: Story = {
  args: { children, source: baseSource } satisfies SourceCardProps,
};

export const Missing: Story = {
  args: { children, source: missingSource } satisfies SourceCardProps,
};

export const Deleted: Story = {
  args: { children, source: deletedSource } satisfies SourceCardProps,
};
