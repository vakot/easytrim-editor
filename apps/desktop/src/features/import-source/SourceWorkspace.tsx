import { useEffect } from "react";
import { Group, Panel, usePanelRef } from "react-resizable-panels";

import { PaneResizeHandle } from "@/components/PaneResizeHandle";
import { EditorStage } from "@/features/editor";
import { DropOverlay } from "./components/DropOverlay";
import { SourceSidebar } from "./components/SourceSidebar";
import { useTranslation } from "react-i18next";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import { useEditorSession } from "@/app/hooks/useEditorSession";

export { CapabilityStatus } from "./components/CapabilityStatus";

export function SourceWorkspace() {
  const { t } = useTranslation();
  const app = useEditorSession();
  const { session, isSourceDragActive, exportQueue } = app;
  const { showSourceDetails, setShowSourceDetails, workspaceLayout, setWorkspaceLayout } =
    useEditorViewState();
  const sourceDetailsPanelRef = usePanelRef();

  useEffect(() => {
    const panel = sourceDetailsPanelRef.current;
    if (!panel) return;

    if (showSourceDetails) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [showSourceDetails, sourceDetailsPanelRef]);

  return (
    <Group
      id="editor-workspace-panels"
      defaultLayout={workspaceLayout}
      onLayoutChanged={setWorkspaceLayout}
      orientation="horizontal"
      className="min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("import.source.workspace")}
    >
      <Panel
        id="source-details-panel"
        panelRef={sourceDetailsPanelRef}
        collapsible
        collapsedSize={0}
        defaultSize="20rem"
        minSize="15rem"
        maxSize="30rem"
        onResize={(size) => {
          const isCollapsed = sourceDetailsPanelRef.current?.isCollapsed() ?? size.inPixels <= 0;
          setShowSourceDetails(!isCollapsed);
        }}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 overflow-hidden bg-card/30"
      >
        <SourceSidebar session={session} queue={exportQueue} />
      </Panel>

      <PaneResizeHandle
        id="source-details-resize-handle"
        label={t("import.source.resizeDetails")}
        orientation="vertical"
      />

      <Panel id="editor-content-panel" minSize="44rem" className="min-h-0 min-w-0 overflow-hidden">
        <div
          className="relative h-full min-h-0 min-w-0"
          aria-label={t("import.source.previewArea")}
        >
          <EditorStage key={session.source?.selection.sourceId ?? "no-source"} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </Panel>
    </Group>
  );
}
