import {
  LayoutPanelLeft,
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ResizablePanelControl } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PanelVisibilityControls() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("app.panels.group")}>
      <Menu modal={false}>
        <MenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("app.panels.layoutMenu")}
          >
            <LayoutPanelLeft className="size-4" aria-hidden="true" />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <ResizablePanelControl panelId="workspace-sidebar">
            {({ isCollapsed }) => (
              <MenuItem
                icon={
                  isCollapsed ? (
                    <PanelLeftDashed className="size-3" aria-hidden="true" />
                  ) : (
                    <PanelLeft className="size-3" aria-hidden="true" />
                  )
                }
                onSelect={(event) => event.preventDefault()}
              >
                {t("app.panels.leftPanel")}
              </MenuItem>
            )}
          </ResizablePanelControl>
          <ResizablePanelControl panelId="editor-stage-timeline">
            {({ isCollapsed }) => (
              <MenuItem
                icon={
                  isCollapsed ? (
                    <PanelLeftDashed className="size-3" aria-hidden="true" />
                  ) : (
                    <PanelLeft className="size-3" aria-hidden="true" />
                  )
                }
                onSelect={(event) => event.preventDefault()}
              >
                {t("app.panels.bottomPanel")}
              </MenuItem>
            )}
          </ResizablePanelControl>
          <MenuSeparator />
          <ResizablePanelControl
            panelId={["workspace-sidebar", "editor-stage-timeline"]}
            mode="reset"
          >
            {({ isExpanded }) => (
              <MenuItem
                disabled={isExpanded}
                icon={<RotateCcw className="size-3" aria-hidden="true" />}
                onSelect={(event) => event.preventDefault()}
              >
                {t("app.panels.resetLayout")}
              </MenuItem>
            )}
          </ResizablePanelControl>
        </MenuContent>
      </Menu>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResizablePanelControl panelId="workspace-sidebar">
            {({ isCollapsed }) => (
              <Button variant="ghost" size="icon-sm">
                {isCollapsed ? (
                  <PanelLeftDashed aria-hidden="true" />
                ) : (
                  <PanelLeft aria-hidden="true" />
                )}
              </Button>
            )}
          </ResizablePanelControl>
        </TooltipTrigger>
        <TooltipContent>
          {t("app.panels.togglePanel", { panel: t("app.panels.leftPanel") })}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ResizablePanelControl panelId="editor-stage-timeline">
            {({ isCollapsed }) => (
              <Button variant="ghost" size="icon-sm">
                {isCollapsed ? (
                  <PanelBottomDashed aria-hidden="true" />
                ) : (
                  <PanelBottom aria-hidden="true" />
                )}
              </Button>
            )}
          </ResizablePanelControl>
        </TooltipTrigger>
        <TooltipContent>
          {t("app.panels.togglePanel", { panel: t("app.panels.bottomPanel") })}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
