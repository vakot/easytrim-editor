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

export const LongContent: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            render-output-2026-09-25-super-high-resolution-source-with-a-very-long-filename.mp4
          </DialogTitle>
          <DialogDescription>
            C:\Media\Projects\Archive\GeneratedIdentifiers\job_01J8QZ0A7V9Y4K2M6N3P5R8T1W0X9Y7Z6A4B2C8D5E3F1G.mp4
          </DialogDescription>
          <DialogDescription>
            This description contains ordinary text across multiple lines. It should keep normal
            word wrapping while long unbroken names wrap inside the dialog.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>MP4 · 1080p</DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
