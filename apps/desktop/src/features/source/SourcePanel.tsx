import { ChevronDown, ChevronRight, Ellipsis, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

import { ExportQueue } from "@/features/export";

import { ImportQueue } from "./components/ImportQueue";
import { SourceDetails } from "./components/SourceDetails";

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

  const handlePanelToggle = (panelId: string) => {
    setPanels({ ...panels, [panelId]: !panels[panelId] });
  };

  return (
    <Card className="relative size-full gap-2 pt-3 pb-1 ring-inset">
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
            <DropdownMenuItem
              disabled
              onSelect={(event) => {
                event.preventDefault();
                handlePanelToggle("workspace-sidebar-source-details");
              }}
            >
              {panels["workspace-sidebar-source-details"] ? (
                <Eye aria-hidden="true" className="size-3" />
              ) : (
                <EyeOff aria-hidden="true" className="size-3" />
              )}
              {t("source.labels.mediaDetails")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handlePanelToggle("workspace-sidebar-import-queue");
              }}
            >
              {panels["workspace-sidebar-import-queue"] ? (
                <Eye aria-hidden="true" className="size-3" />
              ) : (
                <EyeOff aria-hidden="true" className="size-3" />
              )}
              {t("queue.labels.import")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handlePanelToggle("workspace-sidebar-export-queue");
              }}
            >
              {panels["workspace-sidebar-export-queue"] ? (
                <Eye aria-hidden="true" className="size-3" />
              ) : (
                <EyeOff aria-hidden="true" className="size-3" />
              )}
              {t("queue.labels.export")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={enabledCount === 3}
              onSelect={(event) => {
                event.preventDefault();
                setPanels(DEFAULT_PANELS);
              }}
            >
              <RotateCcw aria-hidden="true" className="size-3" />
              {t("app.actions.resetLayout")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResizablePanelGroup id="workspace-sidebar-content" orientation="vertical" persisted>
        {panels["workspace-sidebar-source-details"] && (
          <ResizablePanel
            className="flex min-h-0 flex-col overflow-hidden px-1"
            collapsedSize={32}
            collapsible
            id="workspace-sidebar-source-details"
            minSize={120}
          >
            <ResizablePanelControl panelId="workspace-sidebar-source-details">
              {({ isCollapsed }) => (
                <Button
                  className="my-1 w-full justify-baseline px-2 text-foreground/80"
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

            <ScrollArea className="px-3">
              <SourceDetails />
            </ScrollArea>
          </ResizablePanel>
        )}

        {panels["workspace-sidebar-import-queue"] && (
          <>
            <ResizableHandle />

            <ResizablePanel
              className="flex min-h-0 flex-col overflow-hidden px-1"
              collapsedSize={32}
              collapsible
              id="workspace-sidebar-import-queue"
              minSize={120}
            >
              <ResizablePanelControl panelId="workspace-sidebar-import-queue">
                {({ isCollapsed }) => (
                  <Button
                    className="my-1 w-full justify-baseline px-2 text-foreground/80"
                    size="xs"
                    variant="ghost"
                  >
                    {!isSingle &&
                      (isCollapsed ? (
                        <ChevronRight aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      ))}
                    {t("queue.labels.import")}
                  </Button>
                )}
              </ResizablePanelControl>

              <ScrollArea className="px-3">
                <ImportQueue />
              </ScrollArea>
            </ResizablePanel>
          </>
        )}

        {panels["workspace-sidebar-export-queue"] && (
          <>
            <ResizableHandle />

            <ResizablePanel
              className="flex min-h-0 flex-col overflow-hidden px-1"
              collapsedSize={32}
              collapsible
              id="workspace-sidebar-export-queue"
              minSize={120}
            >
              <ResizablePanelControl panelId="workspace-sidebar-export-queue">
                {({ isCollapsed }) => (
                  <Button
                    className="my-1 w-full justify-baseline px-2 text-foreground/80"
                    size="xs"
                    variant="ghost"
                  >
                    {!isSingle &&
                      (isCollapsed ? (
                        <ChevronRight aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      ))}
                    {t("queue.labels.export")}
                  </Button>
                )}
              </ResizablePanelControl>

              <ScrollArea className="px-3">
                <ExportQueue />
              </ScrollArea>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </Card>
  );
}
