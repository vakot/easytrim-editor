import {
  LayoutPanelLeft,
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ResizablePanelToggle } from "@/components/ui/resizable";
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
          <ResizablePanelToggle panelId="workspace-sidebar">
            {(isCollapsed) => (
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
          </ResizablePanelToggle>
          <ResizablePanelToggle panelId="editor-stage-timeline">
            {(isCollapsed) => (
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
          </ResizablePanelToggle>
          <MenuSeparator />
          {/* <MenuItem
            icon={<RotateCcw className="size-3" aria-hidden="true" />}
            onSelect={(event) => {
              event.preventDefault();
              dispatch(panelsResetToDefault(DEFAULT_PANEL_RESETS));
            }}
          >
            {t("app.panels.resetLayout")}
          </MenuItem> */}
        </MenuContent>
      </Menu>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResizablePanelToggle panelId="workspace-sidebar">
            {(isCollapsed) => (
              <Button variant="ghost" size="icon-sm">
                {isCollapsed ? (
                  <PanelLeftDashed aria-hidden="true" />
                ) : (
                  <PanelLeft aria-hidden="true" />
                )}
              </Button>
            )}
          </ResizablePanelToggle>
        </TooltipTrigger>
        <TooltipContent>
          {t("app.panels.togglePanel", { panel: t("app.panels.leftPanel") })}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ResizablePanelToggle panelId="editor-stage-timeline">
            {(isCollapsed) => (
              <Button variant="ghost" size="icon-sm">
                {isCollapsed ? (
                  <PanelBottomDashed aria-hidden="true" />
                ) : (
                  <PanelBottom aria-hidden="true" />
                )}
              </Button>
            )}
          </ResizablePanelToggle>
        </TooltipTrigger>
        <TooltipContent>
          {t("app.panels.togglePanel", { panel: t("app.panels.bottomPanel") })}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
