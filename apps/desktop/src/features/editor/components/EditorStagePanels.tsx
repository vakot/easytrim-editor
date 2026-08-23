import { useCallback, useRef, useState, type ReactNode } from "react";
import { Group, Panel, type Layout } from "react-resizable-panels";
import { useTranslation } from "react-i18next";

import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import { PaneResizeHandle } from "@/components/PaneResizeHandle";
import { useTimelinePanelSizing } from "../hooks/useTimelinePanelSizing";

interface EditorStagePanelsProps {
  sourceId: string | null;
  audioTrackCount: number;
  preview: ReactNode;
  timeline: ReactNode;
}

export function EditorStagePanels({
  sourceId,
  audioTrackCount,
  preview,
  timeline,
}: EditorStagePanelsProps) {
  const { t } = useTranslation();
  const { editorStageLayout, setEditorStageLayout, showAudioTracks, setShowAudioTracks } =
    useEditorViewState();
  const [emptyPanelsInteractive, setEmptyPanelsInteractive] = useState(sourceId !== null);
  const timelinePanelSizing = useTimelinePanelSizing(
    sourceId,
    audioTrackCount,
    showAudioTracks,
    editorStageLayout !== undefined,
  );
  const initialLayoutRef = useRef(editorStageLayout);
  const currentLayoutRef = useRef(editorStageLayout);
  const handleLayoutChanged = useCallback(
    (nextLayout: Layout) => {
      if (initialLayoutRef.current === undefined) {
        initialLayoutRef.current = nextLayout;
        currentLayoutRef.current = nextLayout;
        return;
      }

      if (areLayoutsEqual(currentLayoutRef.current, nextLayout)) return;

      currentLayoutRef.current = nextLayout;
      setEditorStageLayout(nextLayout);
    },
    [setEditorStageLayout],
  );
  const enableEmptyPanels = useCallback(() => setEmptyPanelsInteractive(true), []);

  return (
    <Group
      id="editor-stage-panels"
      disabled={sourceId === null && !emptyPanelsInteractive}
      defaultLayout={editorStageLayout}
      onLayoutChanged={handleLayoutChanged}
      orientation="vertical"
      className="min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("preview.panes")}
    >
      <Panel id="preview-panel" minSize="14rem" className="min-h-0 min-w-0">
        {preview}
      </Panel>

      <PaneResizeHandle
        id="preview-timeline-resize-handle"
        label={t("preview.resize")}
        orientation="horizontal"
        onDoubleClick={timelinePanelSizing.resetToDefault}
        onFocus={enableEmptyPanels}
        onPointerEnter={enableEmptyPanels}
      />

      <Panel
        id="timeline-panel"
        panelRef={timelinePanelSizing.panelRef}
        defaultSize={timelinePanelSizing.initialDefaultSize}
        collapsible
        collapsedSize={timelinePanelSizing.collapsedSize}
        minSize={timelinePanelSizing.constraints.minSize}
        maxSize={timelinePanelSizing.constraints.maxSize}
        onResize={(size) => {
          const isCollapsed =
            timelinePanelSizing.panelRef.current?.isCollapsed() ?? size.inPixels <= 0;
          setShowAudioTracks(!isCollapsed);
        }}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 bg-background"
      >
        {timeline}
      </Panel>
    </Group>
  );
}

function areLayoutsEqual(currentLayout: Layout | undefined, nextLayout: Layout): boolean {
  if (!currentLayout) {
    return false;
  }

  const currentPanelIds = Object.keys(currentLayout);
  const nextPanelIds = Object.keys(nextLayout);
  if (currentPanelIds.length !== nextPanelIds.length) {
    return false;
  }

  return nextPanelIds.every((panelId) => currentLayout[panelId] === nextLayout[panelId]);
}
