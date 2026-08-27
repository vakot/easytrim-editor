import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";

import { EDITOR_PANEL_GROUP_IDS, registerEditorLayoutReset } from "@/app/editor-layout-runtime";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  EDITOR_PANEL_IDS,
  panelCollapsedChanged,
  selectEditorPanel,
} from "@/app/store/slices/editor-layout-slice";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { PanelContent } from "@/components/layout/panel-content";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
  usePanelRef,
} from "@/components/ui/resizable";
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
  const sourceDetailsPanel = useAppSelector((state) =>
    selectEditorPanel(state, EDITOR_PANEL_IDS.sourceDetails),
  );
  const sourceDetailsPanelRef = usePanelRef();
  const wasSourceDetailsVisible = useRef(sourceDetailsPanel.visible);
  const panelIds = useMemo(
    () =>
      sourceDetailsPanel.visible
        ? ["source-details-panel", "editor-content-panel"]
        : ["editor-content-panel"],
    [sourceDetailsPanel.visible],
  );
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: EDITOR_PANEL_GROUP_IDS.workspace,
    panelIds,
    storage: localStorage,
  });
  const resetPanelSize = useCallback(() => {
    if (sourceDetailsPanel.visible) sourceDetailsPanelRef.current?.resize("20rem");
  }, [sourceDetailsPanel.visible, sourceDetailsPanelRef]);

  useEffect(() => {
    const wasVisible = wasSourceDetailsVisible.current;
    wasSourceDetailsVisible.current = sourceDetailsPanel.visible;
    if (!sourceDetailsPanel.visible || !wasVisible) return;

    const panel = sourceDetailsPanelRef.current;
    if (!panel) return;

    if (sourceDetailsPanel.collapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [sourceDetailsPanel.collapsed, sourceDetailsPanel.visible, sourceDetailsPanelRef]);

  useEffect(() => registerEditorLayoutReset(resetPanelSize), [resetPanelSize]);

  return (
    <ResizablePanelGroup
      id={EDITOR_PANEL_GROUP_IDS.workspace}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      orientation="horizontal"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("import.source.workspace")}
    >
      {sourceDetailsPanel.visible ? (
        <Fragment>
          <ResizablePanel
            id="source-details-panel"
            panelRef={sourceDetailsPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize="20rem"
            minSize="15rem"
            maxSize="30rem"
            onResize={(size) => {
              const collapsed = sourceDetailsPanelRef.current?.isCollapsed() ?? size.inPixels <= 0;
              if (collapsed !== sourceDetailsPanel.collapsed) {
                dispatch(
                  panelCollapsedChanged({
                    panelId: EDITOR_PANEL_IDS.sourceDetails,
                    collapsed,
                  }),
                );
              }
            }}
            groupResizeBehavior="preserve-pixel-size"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <div className="h-full pl-1 pb-1">
              <PanelContent>
                <SourceSidebar />
              </PanelContent>
            </div>
          </ResizablePanel>

          <ResizableHandle
            id="source-details-resize-handle"
            aria-label={t("import.source.resizeDetails")}
            className="mb-1 mx-0.5 bg-transparent"
            withHandle={!sourceDetailsPanel.collapsed}
          />
        </Fragment>
      ) : null}

      <ResizablePanel id="editor-content-panel" minSize="44rem" className="pr-1">
        <div className="relative h-full w-full" aria-label={t("import.source.previewArea")}>
          <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
