import { ChevronDown, ChevronRight, Ellipsis, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);

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
      aria-label={t("import.source.sidebar")}
      className="flex h-full min-h-0 flex-col overflow-hidden p-1"
    >
      <div className="flex h-7 shrink-0 items-center justify-between gap-1 px-2 text-xs font-medium">
        <span>{t("import.source.sidebar")}</span>

        <Menu>
          <Tooltip>
            <TooltipTrigger asChild>
              <MenuTrigger asChild>
                <Button size="icon-xs" variant="ghost">
                  <Ellipsis aria-hidden="true" />
                </Button>
              </MenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("import.source.sidebarControls")}</TooltipContent>
          </Tooltip>
          <MenuContent>
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
              {t("import.source.mediaDetails")}
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
              {t("import.source.importQueue")}
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
              {t("import.source.exportQueue")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              disabled={enabledCount === 3}
              icon={<RotateCcw aria-hidden="true" className="size-3" />}
              onSelect={(event) => {
                event.preventDefault();
                setPanels(DEFAULT_PANELS);
              }}
            >
              {t("app.panels.resetLayout")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <ResizablePanelGroup id="workspace-sidebar-content" orientation="vertical" persisted>
        {panels["workspace-sidebar-source-details"] && (
          <ResizablePanel
            className="flex min-h-0 flex-col overflow-hidden"
            collapsedSize={24}
            collapsible
            id="workspace-sidebar-source-details"
            minSize={120}
          >
            <ResizablePanelControl panelId="workspace-sidebar-source-details">
              {({ isCollapsed }) => (
                <Button
                  className="justify-baseline px-2 w-full text-foreground/80"
                  size="xs"
                  variant="ghost"
                >
                  {!isSingle &&
                    (isCollapsed ? (
                      <ChevronRight aria-hidden="true" />
                    ) : (
                      <ChevronDown aria-hidden="true" />
                    ))}
                  {t("import.source.mediaDetails")}
                </Button>
              )}
            </ResizablePanelControl>
            <PlaceholderRows label="sidebar-source-details" />
          </ResizablePanel>
        )}

        {panels["workspace-sidebar-import-queue"] && (
          <>
            <ResizableHandle className="px-2 bg-transparent" style={{ height: 4 }}>
              <Separator />
            </ResizableHandle>

            <ResizablePanel
              className="flex min-h-0 flex-col overflow-hidden"
              collapsedSize={24}
              collapsible
              id="workspace-sidebar-import-queue"
              minSize={120}
            >
              <ResizablePanelControl panelId="workspace-sidebar-import-queue">
                {({ isCollapsed }) => (
                  <Button
                    className="justify-baseline px-2 w-full text-foreground/80"
                    size="xs"
                    variant="ghost"
                  >
                    {!isSingle &&
                      (isCollapsed ? (
                        <ChevronRight aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      ))}
                    {t("import.source.importQueue")}
                  </Button>
                )}
              </ResizablePanelControl>
              <PlaceholderRows label="workspace-sidebar-import-queue" />
            </ResizablePanel>
          </>
        )}

        {panels["workspace-sidebar-export-queue"] && (
          <>
            <ResizableHandle className="px-2 bg-transparent" style={{ height: 4 }}>
              <Separator />
            </ResizableHandle>

            <ResizablePanel
              className="flex min-h-0 flex-col overflow-hidden"
              collapsedSize={24}
              collapsible
              id="workspace-sidebar-export-queue"
              minSize={120}
            >
              <ResizablePanelControl panelId="workspace-sidebar-export-queue">
                {({ isCollapsed }) => (
                  <Button
                    className="justify-baseline px-2 w-full text-foreground/80"
                    size="xs"
                    variant="ghost"
                  >
                    {!isSingle &&
                      (isCollapsed ? (
                        <ChevronRight aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      ))}
                    {t("import.source.exportQueue")}
                  </Button>
                )}
              </ResizablePanelControl>
              <PlaceholderRows label="workspace-sidebar-export-queue" />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </aside>
  );
}

function PlaceholderRows({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <ScrollArea className="min-h-0 flex-1" type="auto">
      <div className="space-y-1 p-2 text-xs text-muted-foreground">
        {PLACEHOLDER_ROWS.map((row) => (
          <p key={row}>{t("import.source.placeholder", { label, row })}</p>
        ))}
      </div>
    </ScrollArea>
  );
}
