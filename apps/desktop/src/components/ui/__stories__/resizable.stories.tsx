import type { Meta, StoryObj } from "@storybook/react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../resizable";

const meta = {
  component: ResizablePanelGroup,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Resizable Panels",
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <ResizablePanelGroup className="h-48 w-lg rounded-lg border">
      <ResizablePanel defaultSize={35} minSize={20}>
        <div className="flex size-full items-center justify-center text-sm">Source</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65} minSize={30}>
        <div className="flex size-full items-center justify-center text-sm">Preview</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ResizablePanelGroup className="h-64 w-72 rounded-lg border" orientation="vertical">
      <ResizablePanel defaultSize={60}>
        <div className="flex size-full items-center justify-center text-sm">Preview</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={40}>
        <div className="flex size-full items-center justify-center text-sm">Timeline</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
