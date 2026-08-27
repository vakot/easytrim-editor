import { Ellipsis, Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import { EDITOR_PANEL_GROUP_IDS, registerEditorLayoutReset } from "@/app/editor-layout-runtime";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  EDITOR_PANEL_IDS,
  panelCollapsedChanged,
  panelVisibilityToggled,
  selectEditorPanel,
  type EditorPanelId,
} from "@/app/store/slices/editor-layout-slice";
import {
  PaneView,
  PaneViewContent,
  PaneViewItem,
  PaneViewTrigger,
} from "@/components/layout/pane-view";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { useDefaultLayout, useGroupRef } from "@/components/ui/resizable";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);
const SIDEBAR_SPACER_ID = `${EDITOR_PANEL_GROUP_IDS.sourceSidebar}-spacer`;

const PANEL_OPTIONS = [
  { panelId: EDITOR_PANEL_IDS.sidebarMedia, paneId: "media", label: "Media details" },
  {
    panelId: EDITOR_PANEL_IDS.sidebarImportedQueue,
    paneId: "imported",
    label: "Imported queue",
  },
  {
    panelId: EDITOR_PANEL_IDS.sidebarExportQueue,
    paneId: "export",
    label: "Export queue",
  },
] as const satisfies ReadonlyArray<{
  panelId: EditorPanelId;
  paneId: string;
  label: string;
}>;

export function SourceSidebar() {
  const dispatch = useAppDispatch();
  const mediaPanel = useAppSelector((state) =>
    selectEditorPanel(state, EDITOR_PANEL_IDS.sidebarMedia),
  );
  const importedQueuePanel = useAppSelector((state) =>
    selectEditorPanel(state, EDITOR_PANEL_IDS.sidebarImportedQueue),
  );
  const exportQueuePanel = useAppSelector((state) =>
    selectEditorPanel(state, EDITOR_PANEL_IDS.sidebarExportQueue),
  );
  const panels = useMemo(
    () => [
      { ...PANEL_OPTIONS[0], state: mediaPanel },
      { ...PANEL_OPTIONS[1], state: importedQueuePanel },
      { ...PANEL_OPTIONS[2], state: exportQueuePanel },
    ],
    [exportQueuePanel, importedQueuePanel, mediaPanel],
  );
  const visiblePanels = useMemo(() => panels.filter((panel) => panel.state.visible), [panels]);
  const openPaneIds = useMemo(
    () => visiblePanels.filter((panel) => !panel.state.collapsed).map((panel) => panel.paneId),
    [visiblePanels],
  );
  const panelIds = useMemo(
    () => [...visiblePanels.map((panel) => panel.paneId), SIDEBAR_SPACER_ID],
    [visiblePanels],
  );
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: EDITOR_PANEL_GROUP_IDS.sourceSidebar,
    panelIds,
    storage: localStorage,
  });
  const groupRef = useGroupRef();
  const resetPanelSizes = useCallback(() => {
    const size = visiblePanels.length > 0 ? 100 / visiblePanels.length : 0;
    const layout = Object.fromEntries([
      ...visiblePanels.map((panel) => [panel.paneId, size]),
      [SIDEBAR_SPACER_ID, visiblePanels.length > 0 ? 0 : 100],
    ]);
    groupRef.current?.setLayout(layout);
  }, [groupRef, visiblePanels]);

  useEffect(() => registerEditorLayoutReset(resetPanelSizes), [resetPanelSizes]);

  const visibilityOptions: ContextMenuOption[] = panels.map((panel) => ({
    id: `toggle-${panel.paneId}`,
    children: panel.label,
    icon: panel.state.visible ? (
      <Eye className="size-3" aria-hidden="true" />
    ) : (
      <EyeOff className="size-3" aria-hidden="true" />
    ),
    selected: panel.state.visible,
    shouldCloseOnClick: false,
    onSelect: () => dispatch(panelVisibilityToggled(panel.panelId)),
  }));

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden p-1" aria-label="Source sidebar">
      <div className="flex h-7 shrink-0 items-center justify-between gap-1 px-2 text-xs font-medium">
        <span>Source</span>
        <ContextMenu options={visibilityOptions} className="size-6 p-0">
          <>
            <Ellipsis className="size-4" aria-hidden="true" />
            <span className="sr-only">Choose visible source panels</span>
          </>
        </ContextMenu>
      </div>
      <PaneView
        id={EDITOR_PANEL_GROUP_IDS.sourceSidebar}
        aria-label="Source sidebar sections"
        value={openPaneIds}
        onValueChange={(nextOpenPaneIds) => {
          visiblePanels.forEach((panel) => {
            const collapsed = !nextOpenPaneIds.includes(panel.paneId);
            if (collapsed !== panel.state.collapsed) {
              dispatch(panelCollapsedChanged({ panelId: panel.panelId, collapsed }));
            }
          });
        }}
        defaultLayout={defaultLayout}
        groupRef={groupRef}
        onLayoutChanged={onLayoutChanged}
        className="flex-1"
      >
        {mediaPanel.visible ? (
          <PaneViewItem id="media" defaultSize="33%" minSize={120} headerSize={24}>
            <PaneViewTrigger size="xs">Media details</PaneViewTrigger>
            <PaneViewContent>
              <PlaceholderRows label="Media details" />
            </PaneViewContent>
          </PaneViewItem>
        ) : null}

        {importedQueuePanel.visible ? (
          <PaneViewItem id="imported" defaultSize="33%" minSize={120} headerSize={24}>
            <PaneViewTrigger size="xs">Imported queue</PaneViewTrigger>
            <PaneViewContent>
              <PlaceholderRows label="Imported queue" />
            </PaneViewContent>
          </PaneViewItem>
        ) : null}

        {exportQueuePanel.visible ? (
          <PaneViewItem id="export" defaultSize="33%" minSize={120} headerSize={24}>
            <PaneViewTrigger size="xs">Export queue</PaneViewTrigger>
            <PaneViewContent>
              <PlaceholderRows label="Export queue" />
            </PaneViewContent>
          </PaneViewItem>
        ) : null}
      </PaneView>
    </aside>
  );
}

function PlaceholderRows({ label }: { label: string }) {
  return (
    <div className="space-y-1 p-2 text-xs text-muted-foreground">
      {PLACEHOLDER_ROWS.map((row) => (
        <p key={row}>
          {label} placeholder {row}
        </p>
      ))}
    </div>
  );
}
