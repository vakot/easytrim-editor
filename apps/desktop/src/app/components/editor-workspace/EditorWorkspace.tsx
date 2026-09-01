import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { ActivityFeed } from "@/features/activity";
import { SourcePanel } from "@/features/source";

import { EditorStage } from "./EditorStage";

export function EditorWorkspace() {
  return (
    <ResizablePanelGroup className="px-1" id="workspace" persisted>
      <ResizablePanel
        className="pb-1.5 pl-1.5"
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-sidebar"
        maxSize="30rem"
        minSize={294}
      >
        <div className="size-full p-px">
          <Card className="size-full p-0">
            <SourcePanel />
          </Card>
        </div>
      </ResizablePanel>

      <ResizableHandle
        className="self-start bg-transparent"
        style={{ height: "calc(100% - 6px)", width: 6 }}
        withHandle
      />

      <ResizablePanel
        groupResizeBehavior="preserve-relative-size"
        id="workspace-content"
        minSize="40rem"
      >
        <EditorStage />
      </ResizablePanel>

      <ResizableHandle
        className="self-start bg-transparent"
        style={{ height: "calc(100% - 6px)", width: 6 }}
        withHandle
      />

      <ResizablePanel
        className="pr-1.5 pb-1.5"
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-activity"
        maxSize="30rem"
        minSize={294}
      >
        <div className="size-full p-px">
          <Card className="size-full p-0">
            <ActivityFeed />
          </Card>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
