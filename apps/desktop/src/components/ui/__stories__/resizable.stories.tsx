import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

import { Card } from "@/components/ui/card";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelGroup,
} from "../resizable";

const meta = {
  component: ResizablePanelGroup,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  title: "Design System/Resizable Panels",
  decorators: [
    (Story) => (
      <ResizablePanelContextProvider>
        <div className="p-5" style={{ height: "100vh", width: "100vw" }}>
          <Card className="size-full px-2">
            <Story />
          </Card>
        </div>
      </ResizablePanelContextProvider>
    ),
  ],
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;

type Story = StoryObj<ComponentProps<typeof ResizablePanelGroup>>;

export const Horizontal: Story = {
  render: () => (
    <ResizablePanelGroup>
      <ResizablePanel collapsedSize={0} collapsible minSize={120}>
        <div className="flex size-full items-center justify-center text-sm">Source</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel collapsedSize={0} collapsible minSize={120}>
        <div className="flex size-full items-center justify-center text-sm">Preview</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel collapsedSize={0} collapsible minSize={120}>
        <div className="flex size-full items-center justify-center text-sm">Preview</div>
      </ResizablePanel>
      <ResizableHandle className="w-2" withHandle />
      <ResizablePanel collapsedSize={0} collapsible minSize={120}>
        <div className="flex size-full items-center justify-center text-sm">Timeline</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
