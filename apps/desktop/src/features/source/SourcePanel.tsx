import { ChevronDown, ChevronRight, Ellipsis, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueue } from "@/app/store/slices/export-slice";
import { ExportQueue } from "@/features/export";

import { ImportQueue } from "./components/ImportQueue";
import { SourceDetails } from "./components/SourceDetails";
import { useImportQueue } from "./hooks/useImportQueue";

const DEFAULT_PANELS = {
  "workspace-sidebar-source-details": true,
  "workspace-sidebar-import-queue": true,
  "workspace-sidebar-export-queue": true,
};

export function SourcePanel() {
  const { t } = useTranslation();

  const [panels, setPanels] = useState<Record<string, boolean>>(DEFAULT_PANELS);
  const enabledCount = Object.values(panels).filter(Boolean).length;
  const isSingle = enabledCount === 1;

  const handlePanelChange = (panelId: string, checked: boolean) => {
    setPanels((panels) => ({ ...panels, [panelId]: checked }));
  };

  return (
    <Card className="relative size-full gap-2 pt-3 pb-0 ring-inset">
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
                className="absolute top-2 right-3 text-secondary-foreground"
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
              checked={panels["workspace-sidebar-import-queue"]}
              keepOpen
              onCheckedChange={(checked) =>
                handlePanelChange("workspace-sidebar-import-queue", checked === true)
              }
            >
              {t("app.actions.showPanel", { panel: t("queue.labels.import") })}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={panels["workspace-sidebar-export-queue"]}
              keepOpen
              onCheckedChange={(checked) =>
                handlePanelChange("workspace-sidebar-export-queue", checked === true)
              }
            >
              {t("app.actions.showPanel", { panel: t("queue.labels.export") })}
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

        {panels["workspace-sidebar-import-queue"] && (
          <>
            <ResizableHandle />
            <ImportQueuePanel isSingle={isSingle} />
          </>
        )}

        {panels["workspace-sidebar-export-queue"] && (
          <>
            <ResizableHandle />
            <ExportQueuePanel isSingle={isSingle} />
          </>
        )}
      </ResizablePanelGroup>
    </Card>
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
      collapsedSize={32}
      collapsible
      id="workspace-sidebar-source-details"
      minSize={128}
    >
      <div className="px-1">
        <ResizablePanelControl panelId="workspace-sidebar-source-details">
          {({ isCollapsed }) => (
            <Button
              className="my-1 w-full justify-baseline pr-3 pl-2 text-foreground/80"
              size="xs"
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

function ImportQueuePanel({ isSingle = false }: SourcePanelProps) {
  const { t } = useTranslation();
  const { activeIndex, items } = useImportQueue();

  const position = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden"
      collapsedSize={32}
      collapsible
      id="workspace-sidebar-import-queue"
      minSize={128}
    >
      <div className="px-1">
        <ResizablePanelControl panelId="workspace-sidebar-import-queue">
          {({ isCollapsed }) => (
            <Button
              aria-label={t("queue.labels.import")}
              className="my-1 flex w-full justify-between pr-3 pl-2 text-foreground/80"
              size="xs"
              variant="ghost"
            >
              <span className="flex items-center gap-1">
                {!isSingle &&
                  (isCollapsed ? (
                    <ChevronRight aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  ))}
                {t("queue.labels.import")}
              </span>
              <span className="text-xs text-muted-foreground">
                {position} / {items.length}
              </span>
            </Button>
          )}
        </ResizablePanelControl>
      </div>

      <ScrollArea className="px-3">
        <ImportQueue />
      </ScrollArea>
    </ResizablePanel>
  );
}

function ExportQueuePanel({ isSingle = false }: SourcePanelProps) {
  const { t } = useTranslation();

  const queue = useAppSelector(selectExportQueue);
  const queueIncomplete = queue.filter(
    (queueItem) => queueItem.status === "queued" || queueItem.status === "rendering",
  );

  const queueProgress = queue.length - queueIncomplete.length;

  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden"
      collapsedSize={32}
      collapsible
      id="workspace-sidebar-export-queue"
      minSize={128}
    >
      <div className="px-1">
        <ResizablePanelControl panelId="workspace-sidebar-export-queue">
          {({ isCollapsed }) => (
            <Button
              className="my-1 flex w-full justify-between pr-3 pl-2 text-foreground/80"
              size="xs"
              variant="ghost"
            >
              <span className="flex items-center gap-1">
                {!isSingle &&
                  (isCollapsed ? (
                    <ChevronRight aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  ))}
                {t("queue.labels.export")}
              </span>
              <span className="text-xs text-muted-foreground">
                {queueProgress} / {queue.length}
              </span>
            </Button>
          )}
        </ResizablePanelControl>
      </div>

      <ScrollArea className="px-3">
        <ExportQueue />
      </ScrollArea>
    </ResizablePanel>
  );
}
