import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PANEL_GROUP_IDS } from "@/app/panel-layout-runtime";
import { PANEL_IDS } from "@/app/store/slices/panel-layout-slice";
import {
  PaneView,
  PaneViewContent,
  PaneViewItem,
  PaneViewTrigger,
  PaneVisibilityMenu,
  PaneVisibilityMenuContent,
  PaneVisibilityMenuTrigger,
  type PaneRegistration,
} from "@/components/layout/pane-view";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);

const PANEL_OPTIONS = [
  {
    panelId: PANEL_IDS.sidebarMedia,
    id: "media",
    labelKey: "import.source.mediaDetails",
    fixedVisible: true,
  },
  {
    panelId: PANEL_IDS.sidebarImportedQueue,
    id: "imported",
    labelKey: "import.source.importedQueue",
  },
  {
    panelId: PANEL_IDS.sidebarExportQueue,
    id: "export",
    labelKey: "import.source.exportQueue",
  },
] as const satisfies readonly (PaneRegistration & { labelKey: string })[];

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
        <PaneVisibilityMenu
          panels={visibilityPanels}
          aria-label={t("import.source.sidebarControls")}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PaneVisibilityMenuTrigger asChild>
                <Button size="icon-xs" variant="ghost">
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Button>
              </PaneVisibilityMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("import.source.sidebarControls")}</TooltipContent>
          </Tooltip>
          <PaneVisibilityMenuContent />
        </PaneVisibilityMenu>
      </div>
      <PaneView
        id={PANEL_GROUP_IDS.sourceSidebar}
        panels={PANEL_OPTIONS}
        aria-label={t("import.source.sidebarSections")}
        className="flex-1"
      >
        <PaneViewItem id="media" defaultSize="33%" minSize={120} headerSize={24}>
          <PaneViewTrigger size="xs" fixedWhenAlone>
            {t(PANEL_OPTIONS[0].labelKey)}
          </PaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label={t(PANEL_OPTIONS[0].labelKey)} />
          </PaneViewContent>
        </PaneViewItem>

        <PaneViewItem id="imported" defaultSize="33%" minSize={120} headerSize={24}>
          <PaneViewTrigger size="xs">{t(PANEL_OPTIONS[1].labelKey)}</PaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label={t(PANEL_OPTIONS[1].labelKey)} />
          </PaneViewContent>
        </PaneViewItem>

        <PaneViewItem id="export" defaultSize="33%" minSize={120} headerSize={24}>
          <PaneViewTrigger size="xs">{t(PANEL_OPTIONS[2].labelKey)}</PaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label={t(PANEL_OPTIONS[2].labelKey)} />
          </PaneViewContent>
        </PaneViewItem>
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
