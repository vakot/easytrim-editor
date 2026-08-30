import type { Meta, StoryObj } from "@storybook/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";

const meta = {
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Dialog",
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger className="rounded-md border px-3 py-2 text-sm">Open dialog</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Export project</DialogTitle>
          <DialogDescription>Review your export settings before continuing.</DialogDescription>
        </DialogHeader>
        <DialogFooter>MP4 · 1080p</DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
