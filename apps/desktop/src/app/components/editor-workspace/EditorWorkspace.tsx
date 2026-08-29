import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { SourceDropOverlay, SourcePanel } from "@/features/source";

import { EditorStage } from "./EditorStage";

export function EditorWorkspace() {
  const sourceSelection = useAppSelector(selectSourceSelection);
  const activeItemId = useAppSelector(selectActiveItemId);

  return (
    <ResizablePanelGroup id="workspace" persisted>
      <ResizablePanel
        className="overflow-hidden"
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-sidebar"
        maxSize="30rem"
        minSize="15rem"
      >
        <div className="h-full pb-1 pl-1">
          <div className="h-full overflow-hidden rounded-md border border-border bg-card/30">
            <SourcePanel />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle className="bg-transparent" style={{ width: 4 }} withHandle />

      <ResizablePanel className="overflow-hidden" id="workspace-content" minSize="44rem">
        <div className="relative h-full pr-1">
          <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
          <SourceDropOverlay />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
