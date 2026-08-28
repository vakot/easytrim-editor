import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/hooks";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { EditorStage } from "@/features/editor";
import { DropOverlay } from "@/features/source/components/DropOverlay";
import { SourceSidebar } from "@/features/source/components/SourceSidebar";

export { CapabilityStatus } from "./components/CapabilityStatus";

export function SourceWorkspace() {
  const isSourceDragActive = useAppSelector(selectIsSourceDragActive);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const activeItemId = useAppSelector(selectActiveItemId);

  return (
    <ResizablePanelGroup id="workspace" persisted>
      <ResizablePanel
        id="workspace-sidebar"
        collapsible
        collapsedSize={0}
        defaultSize="20rem"
        minSize="15rem"
        maxSize="30rem"
        groupResizeBehavior="preserve-pixel-size"
        className="overflow-hidden"
      >
        <div className="h-full pl-1 pb-1">
          <div className="rounded-md border border-border h-full overflow-hidden bg-card/30">
            <SourceSidebar />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle style={{ width: 4 }} className="bg-transparent" />

      <ResizablePanel id="workspace-content" minSize="44rem" className="overflow-hidden">
        <div className="relative h-full pr-1">
          <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
