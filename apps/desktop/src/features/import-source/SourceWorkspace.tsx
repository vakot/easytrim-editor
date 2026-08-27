import { useEffect, useRef } from "react";
import { Group, Panel, usePanelRef } from "react-resizable-panels";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelVisibilityChanged,
  selectPanelVisibility,
  selectWorkspaceLayout,
  workspaceLayoutChanged,
} from "@/app/store/slices/editor-layout-slice";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { PanelContent } from "@/components/layout/panel-content";
import { PanelSeparator } from "@/components/layout/panel-separator";
import { EditorStage } from "@/features/editor";
import { useTranslation } from "react-i18next";
import { DropOverlay } from "./components/DropOverlay";
import { SourceSidebar } from "./components/SourceSidebar";

export { CapabilityStatus } from "./components/CapabilityStatus";

export function SourceWorkspace() {
  const { t } = useTranslation();
  const isSourceDragActive = useAppSelector(selectIsSourceDragActive);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const activeItemId = useAppSelector(selectActiveItemId);
  const dispatch = useAppDispatch();
  const isLeftPanelVisible = useAppSelector((state) => selectPanelVisibility(state, "left"));
  const workspaceLayout = useAppSelector(selectWorkspaceLayout);
  const sourceDetailsPanelRef = usePanelRef();
  const previousWorkspaceLayout = useRef(workspaceLayout);

  useEffect(() => {
    const panel = sourceDetailsPanelRef.current;
    if (!panel) return;

    if (isLeftPanelVisible) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [isLeftPanelVisible, sourceDetailsPanelRef]);

  useEffect(() => {
    if (workspaceLayout === undefined && previousWorkspaceLayout.current !== undefined) {
      sourceDetailsPanelRef.current?.resize("20rem");
    }
    previousWorkspaceLayout.current = workspaceLayout;
  }, [sourceDetailsPanelRef, workspaceLayout]);

  return (
    <Group
      id="editor-workspace-panels"
      defaultLayout={workspaceLayout}
      onLayoutChanged={(layout) => dispatch(workspaceLayoutChanged(layout))}
      orientation="horizontal"
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
          dispatch(panelVisibilityChanged({ panelId: "left", visible: !isCollapsed }));
        }}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <div className="h-full pl-1 pb-1">
          <PanelContent>
            <SourceSidebar />
          </PanelContent>
        </div>
      </Panel>

      <PanelSeparator
        id="source-details-resize-handle"
        label={t("import.source.resizeDetails")}
        orientation="vertical"
        collapsed={!isLeftPanelVisible}
        className="mb-1"
      />

      <Panel id="editor-content-panel" minSize="44rem" className="pr-1">
        <div className="relative h-full w-full" aria-label={t("import.source.previewArea")}>
          <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </Panel>
    </Group>
  );
}
