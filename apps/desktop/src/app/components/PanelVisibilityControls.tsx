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
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { ResizablePanelControl } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PanelVisibilityControls() {
  const { t } = useTranslation();

  return (
    <div aria-label={t("app.panels.group")} className="flex items-center gap-0.5" role="group">
      <Tooltip>
        <Menu modal={false}>
          <MenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("app.panels.layoutMenu")}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <LayoutPanelLeft aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
          </MenuTrigger>
          <MenuContent>
            <MenuGroup>
              <ResizablePanelControl panelId="workspace-sidebar">
                {({ isCollapsed }) => (
                  <MenuItem
                    icon={
                      isCollapsed ? (
                        <PanelLeftDashed aria-hidden="true" className="size-3" />
                      ) : (
                        <PanelLeft aria-hidden="true" className="size-3" />
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
                        <PanelLeftDashed aria-hidden="true" className="size-3" />
                      ) : (
                        <PanelLeft aria-hidden="true" className="size-3" />
                      )
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {t("app.panels.bottomPanel")}
                  </MenuItem>
                )}
              </ResizablePanelControl>
            </MenuGroup>
            <MenuSeparator />
            <MenuGroup>
              <ResizablePanelControl
                mode="reset"
                panelId={["workspace-sidebar", "editor-stage-timeline"]}
              >
                {({ isExpanded }) => (
                  <MenuItem
                    disabled={isExpanded}
                    icon={<RotateCcw aria-hidden="true" className="size-3" />}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {t("app.panels.resetLayout")}
                  </MenuItem>
                )}
              </ResizablePanelControl>
            </MenuGroup>
          </MenuContent>
        </Menu>
        <TooltipContent>{t("app.panels.customizeLayout")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <ResizablePanelControl panelId="workspace-sidebar">
          {({ isCollapsed }) => (
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                {isCollapsed ? (
                  <PanelLeftDashed aria-hidden="true" />
                ) : (
                  <PanelLeft aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
          )}
        </ResizablePanelControl>
        <TooltipContent>
          {t("app.panels.togglePanel", { panel: t("app.panels.leftPanel") })}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <ResizablePanelControl panelId="editor-stage-timeline">
          {({ isCollapsed }) => (
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                {isCollapsed ? (
                  <PanelBottomDashed aria-hidden="true" />
                ) : (
                  <PanelBottom aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
          )}
        </ResizablePanelControl>
        <TooltipContent>
          {t("app.panels.togglePanel", { panel: t("app.panels.bottomPanel") })}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
