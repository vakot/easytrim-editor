import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  EditorPaneView,
  EditorPaneViewTrigger,
  EditorPaneVisibilityMenu,
  type EditorPaneRegistration,
} from "@/app/components/EditorPaneView";
import { EDITOR_PANEL_GROUP_IDS } from "@/app/editor-layout-runtime";
import { EDITOR_PANEL_IDS } from "@/app/store/slices/editor-layout-slice";
import { PaneViewContent, PaneViewItem } from "@/components/layout/pane-view";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);

const PANEL_OPTIONS = [
  {
    panelId: EDITOR_PANEL_IDS.sidebarMedia,
    id: "media",
    labelKey: "import.source.mediaDetails",
    fixedVisible: true,
  },
  {
    panelId: EDITOR_PANEL_IDS.sidebarImportedQueue,
    id: "imported",
    labelKey: "import.source.importedQueue",
  },
  {
    panelId: EDITOR_PANEL_IDS.sidebarExportQueue,
    id: "export",
    labelKey: "import.source.exportQueue",
  },
] as const satisfies readonly (EditorPaneRegistration & { labelKey: string })[];

export function SourceSidebar() {
  const { t } = useTranslation();
  const visibilityPanels = PANEL_OPTIONS.map((panel) => ({
    ...panel,
    label: t(panel.labelKey),
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
              <EditorPaneVisibilityMenu
                panels={visibilityPanels}
                className="size-6 p-0"
                aria-label={t("import.source.sidebarControls")}
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </EditorPaneVisibilityMenu>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("import.source.sidebarControls")}</TooltipContent>
        </Tooltip>
      </div>
      <EditorPaneView
        id={EDITOR_PANEL_GROUP_IDS.sourceSidebar}
        panels={PANEL_OPTIONS}
        aria-label={t("import.source.sidebarSections")}
        className="flex-1"
      >
        <PaneViewItem id="media" defaultSize="33%" minSize={120} headerSize={24}>
          <EditorPaneViewTrigger size="xs" fixedWhenAlone>
            {t(PANEL_OPTIONS[0].labelKey)}
          </EditorPaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label={t(PANEL_OPTIONS[0].labelKey)} />
          </PaneViewContent>
        </PaneViewItem>

        <PaneViewItem id="imported" defaultSize="33%" minSize={120} headerSize={24}>
          <EditorPaneViewTrigger size="xs">{t(PANEL_OPTIONS[1].labelKey)}</EditorPaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label={t(PANEL_OPTIONS[1].labelKey)} />
          </PaneViewContent>
        </PaneViewItem>

        <PaneViewItem id="export" defaultSize="33%" minSize={120} headerSize={24}>
          <EditorPaneViewTrigger size="xs">{t(PANEL_OPTIONS[2].labelKey)}</EditorPaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label={t(PANEL_OPTIONS[2].labelKey)} />
          </PaneViewContent>
        </PaneViewItem>
      </EditorPaneView>
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
