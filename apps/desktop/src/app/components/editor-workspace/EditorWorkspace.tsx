import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import {
  EditorSource,
  type EditorSourceCollapsibleSection,
  type EditorSourceCollapsibleState,
} from "@/app/components/editor-workspace/EditorSource";

import { EditorStage } from "./EditorStage";

interface EditorWorkspaceProps {
  editorSourceCollapsibleState: EditorSourceCollapsibleState;
  onEditorSourceCollapsibleStateChange: (
    section: EditorSourceCollapsibleSection,
    open: boolean,
  ) => void;
}

export function EditorWorkspace({
  editorSourceCollapsibleState,
  onEditorSourceCollapsibleStateChange,
}: EditorWorkspaceProps) {
  return (
    <ResizablePanelGroup className="px-1" id="workspace" persisted>
      <ResizablePanel
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-sidebar"
        maxSize="45rem"
        minSize={380}
      >
        <div className="size-full pb-1.5 pl-1.5">
          <div className="size-full p-px">
            <Card className="size-full p-0">
              <EditorSource
                collapsibleState={editorSourceCollapsibleState}
                onCollapsibleStateChange={onEditorSourceCollapsibleStateChange}
              />
            </Card>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle
        className="self-start bg-transparent"
        style={{ height: "calc(100% - 6px)", width: 6 }}
        withHandle
      />

      <ResizablePanel
        className="pr-1.5"
        groupResizeBehavior="preserve-relative-size"
        id="workspace-content"
        minSize="40rem"
      >
        <EditorStage />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
