import { ChevronDown, ChevronRight, Ellipsis, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
    <aside
      aria-label={t("source.labels.title")}
      className="flex h-full min-h-0 flex-col overflow-hidden p-1"
    >
      <div className="flex h-7 shrink-0 items-center justify-between gap-1 px-2 text-xs font-medium">
        <span>{t("source.labels.title")}</span>

        <Menu>
          <Tooltip>
            <TooltipTrigger asChild>
              <MenuTrigger asChild>
                <Button size="icon-xs" variant="ghost">
                  <Ellipsis aria-hidden="true" />
                </Button>
              </MenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("source.tooltips.sidebarControls")}</TooltipContent>
          </Tooltip>
          <MenuContent>
            <MenuGroup>
              <MenuItem
                disabled
                icon={
                  panels["workspace-sidebar-source-details"] ? (
                    <Eye aria-hidden="true" className="size-3" />
                  ) : (
                    <EyeOff aria-hidden="true" className="size-3" />
                  )
                }
                onSelect={(event) => {
                  event.preventDefault();
                  handlePanelToggle("workspace-sidebar-source-details");
                }}
              >
                {t("source.labels.mediaDetails")}
              </MenuItem>
              <MenuItem
                icon={
                  panels["workspace-sidebar-import-queue"] ? (
                    <Eye aria-hidden="true" className="size-3" />
                  ) : (
                    <EyeOff aria-hidden="true" className="size-3" />
                  )
                }
                onSelect={(event) => {
                  event.preventDefault();
                  handlePanelToggle("workspace-sidebar-import-queue");
                }}
              >
                {t("queue.labels.import")}
              </MenuItem>
              <MenuItem
                icon={
                  panels["workspace-sidebar-export-queue"] ? (
                    <Eye aria-hidden="true" className="size-3" />
                  ) : (
                    <EyeOff aria-hidden="true" className="size-3" />
                  )
                }
                onSelect={(event) => {
                  event.preventDefault();
                  handlePanelToggle("workspace-sidebar-export-queue");
                }}
              >
                {t("queue.labels.export")}
              </MenuItem>
            </MenuGroup>
            <MenuSeparator />
            <MenuGroup>
              <MenuItem
                disabled={enabledCount === 3}
                icon={<RotateCcw aria-hidden="true" className="size-3" />}
                onSelect={(event) => {
                  event.preventDefault();
                  setPanels(DEFAULT_PANELS);
                }}
              >
                {t("app.actions.resetLayout")}
              </MenuItem>
            </MenuGroup>
          </MenuContent>
        </Menu>
      </div>

      <ResizablePanelGroup id="workspace-sidebar-content" orientation="vertical" persisted>
        {panels["workspace-sidebar-source-details"] && (
          <ResizablePanel
            className="flex min-h-0 flex-col overflow-hidden"
            collapsedSize={28}
            collapsible
            id="workspace-sidebar-source-details"
            minSize={120}
          >
            <ResizablePanelControl panelId="workspace-sidebar-source-details">
              {({ isCollapsed }) => (
                <Button
                  className="my-0.5 w-full justify-baseline px-2 text-foreground/80"
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
            <ResizableHandle className="bg-transparent px-2">
              <Separator />
            </ResizableHandle>

            <ResizablePanel
              className="flex min-h-0 flex-col overflow-hidden"
              collapsedSize={28}
              collapsible
              id="workspace-sidebar-import-queue"
              minSize={120}
            >
              <ResizablePanelControl panelId="workspace-sidebar-import-queue">
                {({ isCollapsed }) => (
                  <Button
                    className="my-0.5 w-full justify-baseline px-2 text-foreground/80"
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
            <ResizableHandle className="bg-transparent px-2">
              <Separator />
            </ResizableHandle>

            <ResizablePanel
              className="flex min-h-0 flex-col overflow-hidden"
              collapsedSize={28}
              collapsible
              id="workspace-sidebar-export-queue"
              minSize={120}
            >
              <ResizablePanelControl panelId="workspace-sidebar-export-queue">
                {({ isCollapsed }) => (
                  <Button
                    className="my-0.5 w-full justify-baseline px-2 text-foreground/80"
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
    </aside>
  );
}
