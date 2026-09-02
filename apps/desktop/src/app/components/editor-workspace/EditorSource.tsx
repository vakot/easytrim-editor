import { ChevronDown, ChevronRight, Ellipsis, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { SourceDetails, SourceTabs, SourceTree } from "@/features/source";

const DEFAULT_PANELS = {
  "workspace-sidebar-source-details": true,
  "workspace-sidebar-active-sources": true,
  "workspace-sidebar-explorer": true,
};

const PANEL_MIN_SIZE = 138;
const PANEL_COLLAPSED_SIZE = 32;

export function EditorSource() {
  const { t } = useTranslation();

  const [panels, setPanels] = useState<Record<string, boolean>>(DEFAULT_PANELS);
  const enabledCount = Object.values(panels).filter(Boolean).length;
  const isSingle = enabledCount === 1;

  const handlePanelChange = (panelId: string, checked: boolean) => {
    setPanels((panels) => ({ ...panels, [panelId]: checked }));
  };

  return (
    <aside
      aria-label={t("source.labels.title")}
      className="relative flex size-full min-h-0 flex-col pt-3"
    >
      <h3
        className="mx-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("source.labels.title")}
      </h3>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                className="absolute top-1 right-3 text-secondary-foreground"
                size="icon-xs"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("source.tooltips.sidebarControls")}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              checked={panels["workspace-sidebar-source-details"]}
              disabled
              keepOpen
              onCheckedChange={(checked) =>
                handlePanelChange("workspace-sidebar-source-details", checked === true)
              }
            >
              {t("app.actions.showPanel", { panel: t("source.labels.mediaDetails") })}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={panels["workspace-sidebar-active-sources"]}
              keepOpen
              onCheckedChange={(checked) =>
                handlePanelChange("workspace-sidebar-active-sources", checked === true)
              }
            >
              {t("app.actions.showPanel", { panel: t("queue.labels.activeSources") })}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={panels["workspace-sidebar-explorer"]}
              keepOpen
              onCheckedChange={(checked) =>
                handlePanelChange("workspace-sidebar-explorer", checked === true)
              }
            >
              {t("app.actions.showPanel", { panel: t("queue.labels.explorer") })}
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={enabledCount === 3}
              inset
              keepOpen
              onSelect={() => setPanels(DEFAULT_PANELS)}
            >
              <DropdownMenuIcon>
                <RotateCcw aria-hidden="true" className="size-3" />
              </DropdownMenuIcon>
              {t("app.actions.resetLayout")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResizablePanelGroup id="workspace-sidebar-content" orientation="vertical" persisted>
        {panels["workspace-sidebar-source-details"] && <SourceDetailsPanel isSingle={isSingle} />}

        {panels["workspace-sidebar-active-sources"] && (
          <>
            <ResizableHandle className="bg-foreground/10" />
            <SourceTabsPanel isSingle={isSingle} />
          </>
        )}

        {panels["workspace-sidebar-explorer"] && (
          <>
            <ResizableHandle className="bg-foreground/10" />
            <SourceTreePanel />
          </>
        )}
      </ResizablePanelGroup>
    </aside>
  );
}

interface SourcePanelProps {
  isSingle?: boolean;
}

function SourceDetailsPanel({ isSingle = false }: SourcePanelProps) {
  const { t } = useTranslation();

  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden"
      collapsedSize={PANEL_COLLAPSED_SIZE}
      collapsible
      id="workspace-sidebar-source-details"
      minSize={PANEL_MIN_SIZE}
    >
      <div className="px-1">
        <ResizablePanelControl panelId="workspace-sidebar-source-details">
          {({ isCollapsed }) => (
            <Button
              className="my-0.5 w-full justify-baseline pr-3 pl-2 text-foreground/80"
              size="sm"
              variant="ghost"
            >
              {!isSingle &&
                (isCollapsed ? (
                  <ChevronRight aria-hidden="true" />
                ) : (
                  <ChevronDown aria-hidden="true" />
                ))}
              {t("source.labels.mediaDetails")}
            </Button>
          )}
        </ResizablePanelControl>
      </div>

      <ScrollArea className="px-3">
        <SourceDetails />
      </ScrollArea>
    </ResizablePanel>
  );
}

function SourceTabsPanel({ isSingle = false }: SourcePanelProps) {
  const { t } = useTranslation();

  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden"
      collapsedSize={PANEL_COLLAPSED_SIZE}
      collapsible
      defaultSize={0}
      id="workspace-sidebar-active-sources"
      minSize={PANEL_MIN_SIZE}
    >
      <div className="px-1">
        <ResizablePanelControl panelId="workspace-sidebar-active-sources">
          {({ isCollapsed }) => (
            <Button
              aria-label={t("queue.labels.import")}
              className="my-0.5 flex w-full justify-between pr-3 pl-2 text-foreground/80"
              size="sm"
              variant="ghost"
            >
              <span className="flex items-center gap-1">
                {!isSingle &&
                  (isCollapsed ? (
                    <ChevronRight aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  ))}
                Active sources
              </span>
            </Button>
          )}
        </ResizablePanelControl>
      </div>

      <ScrollArea className="px-2">
        <SourceTabs background="card" orientation="vertical" />
      </ScrollArea>
    </ResizablePanel>
  );
}

function SourceTreePanel({ isSingle = false }: SourcePanelProps) {
  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden"
      collapsedSize={PANEL_COLLAPSED_SIZE}
      collapsible
      defaultSize={0}
      id="workspace-sidebar-explorer"
      minSize={PANEL_MIN_SIZE}
    >
      <div className="px-1">
        <ResizablePanelControl panelId="workspace-sidebar-explorer">
          {({ isCollapsed }) => (
            <Button
              aria-label="Explorer"
              className="my-0.5 flex w-full justify-between pr-3 pl-2 text-foreground/80"
              size="sm"
              variant="ghost"
            >
              <span className="flex items-center gap-1">
                {!isSingle &&
                  (isCollapsed ? (
                    <ChevronRight aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  ))}
                Explorer
              </span>
            </Button>
          )}
        </ResizablePanelControl>
      </div>

      <ScrollArea className="px-2">
        <SourceTree />
      </ScrollArea>
    </ResizablePanel>
  );
}
