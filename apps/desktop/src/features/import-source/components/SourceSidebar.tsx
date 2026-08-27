import { Ellipsis, Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);
const SIDEBAR_SPACER_ID = `${EDITOR_PANEL_GROUP_IDS.sourceSidebar}-spacer`;

const PANEL_OPTIONS = [
  {
    panelId: EDITOR_PANEL_IDS.sidebarMedia,
    paneId: "media",
    labelKey: "import.source.mediaDetails",
  },
  {
    panelId: EDITOR_PANEL_IDS.sidebarImportedQueue,
    paneId: "imported",
    labelKey: "import.source.importedQueue",
  },
  {
    panelId: EDITOR_PANEL_IDS.sidebarExportQueue,
    paneId: "export",
    labelKey: "import.source.exportQueue",
  },
] as const satisfies ReadonlyArray<{
  panelId: EditorPanelId;
  paneId: string;
  labelKey: string;
}>;

export function SourceSidebar() {
  const { t } = useTranslation();
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
    children: t(panel.labelKey),
    icon: panel.state.visible ? (
      <Eye className="size-3" aria-hidden="true" />
    ) : (
      <EyeOff className="size-3" aria-hidden="true" />
    ),
    shouldCloseOnClick: false,
    onSelect: () => dispatch(panelVisibilityToggled(panel.panelId)),
  }));

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden p-1"
      aria-label={t("import.source.sidebar")}
    >
      <div className="flex h-7 shrink-0 items-center justify-between gap-1 px-2 text-xs font-medium">
        <span>{t("import.source.sidebar")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <ContextMenu
                options={visibilityOptions}
                className="size-6 p-0"
                aria-label={t("import.source.sidebarControls")}
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </ContextMenu>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("import.source.sidebarControls")}</TooltipContent>
        </Tooltip>
      </div>
      <PaneView
        id={EDITOR_PANEL_GROUP_IDS.sourceSidebar}
        aria-label={t("import.source.sidebarSections")}
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
            <PaneViewTrigger size="xs">{t(PANEL_OPTIONS[0].labelKey)}</PaneViewTrigger>
            <PaneViewContent>
              <PlaceholderRows label={t(PANEL_OPTIONS[0].labelKey)} />
            </PaneViewContent>
          </PaneViewItem>
        ) : null}

        {importedQueuePanel.visible ? (
          <PaneViewItem id="imported" defaultSize="33%" minSize={120} headerSize={24}>
            <PaneViewTrigger size="xs">{t(PANEL_OPTIONS[1].labelKey)}</PaneViewTrigger>
            <PaneViewContent>
              <PlaceholderRows label={t(PANEL_OPTIONS[1].labelKey)} />
            </PaneViewContent>
          </PaneViewItem>
        ) : null}

        {exportQueuePanel.visible ? (
          <PaneViewItem id="export" defaultSize="33%" minSize={120} headerSize={24}>
            <PaneViewTrigger size="xs">{t(PANEL_OPTIONS[2].labelKey)}</PaneViewTrigger>
            <PaneViewContent>
              <PlaceholderRows label={t(PANEL_OPTIONS[2].labelKey)} />
            </PaneViewContent>
          </PaneViewItem>
        ) : null}
      </PaneView>
    </aside>
  );
}

function PlaceholderRows({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1 p-2 text-xs text-muted-foreground">
      {PLACEHOLDER_ROWS.map((row) => (
        <p key={row}>{t("import.source.placeholder", { label, row })}</p>
      ))}
    </div>
  );
}
