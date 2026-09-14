import type { Meta, StoryObj } from "@storybook/react";

import { SourceCard, type SourceCardProps } from "../SourceCard";

const labels: SourceCardProps["labels"] = {
  actions: "Source actions",
  active: "Active source",
  close: "Close source",
  deleteSource: "Delete source file",
  imported: "Imported source",
  open: "Open",
  previewUnavailable: "Preview unavailable",
  reveal: "Reveal in file manager",
  restore: "Restore",
  restoreSource: "Restore source",
};

const meta = {
  component: SourceCard,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
  title: "Source/Imported Source Card",
} satisfies Meta<typeof SourceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs: SourceCardProps = {
  active: true,
  displayName: "travel-highlights.mp4",
  id: "source-1",
  labels,
  onClose: () => undefined,
  onDelete: () => undefined,
  onOpen: () => undefined,
  onReveal: () => undefined,
  onRestore: () => undefined,
  showRestore: false,
  sourcePath: "C:/Media/2026/travel-highlights.mp4",
  status: "ready",
  statusLabel: "Ready",
  variant: "success",
};

export const Ready: Story = {
  args: baseArgs,
};

export const Rendering: Story = {
  args: {
    ...baseArgs,
    active: false,
    status: "rendering",
    statusLabel: "Rendering...",
    variant: "warning",
  },
};

export const Failed: Story = {
  args: {
    ...baseArgs,
    active: false,
    status: "failed",
    statusLabel: "Failed",
    variant: "destructive",
  },
};

export const Deleted: Story = {
  args: {
    ...baseArgs,
    active: false,
    showRestore: true,
    status: "deleted",
    statusLabel: "Deleted",
    variant: "destructive",
  },
};
