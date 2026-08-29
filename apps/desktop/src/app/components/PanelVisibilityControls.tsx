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
    <div
      aria-label={t("app.accessibility.panels")}
      className="flex items-center gap-0.5"
      role="group"
    >
      <Tooltip>
        <Menu modal={false}>
          <MenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("app.accessibility.layoutControls")}
                className="text-secondary-foreground"
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
                    {t("app.labels.leftPanel")}
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
                    {t("app.labels.bottomPanel")}
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
                    {t("app.actions.resetLayout")}
                  </MenuItem>
                )}
              </ResizablePanelControl>
            </MenuGroup>
          </MenuContent>
        </Menu>
        <TooltipContent>{t("app.tooltips.customizeLayout")}</TooltipContent>
      </Tooltip>
      <Tooltip preserveOnTrigger>
        <ResizablePanelControl panelId="workspace-sidebar">
          {({ isCollapsed }) => (
            <TooltipTrigger asChild>
              <Button className="text-secondary-foreground" size="icon-sm" variant="ghost">
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
          {t("app.tooltips.togglePanel", { panel: t("app.labels.leftPanel") })}
        </TooltipContent>
      </Tooltip>

      <Tooltip preserveOnTrigger>
        <ResizablePanelControl panelId="editor-stage-audio">
          {({ isCollapsed }) => (
            <TooltipTrigger asChild>
              <Button className="text-secondary-foreground" size="icon-sm" variant="ghost">
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
          {t("app.tooltips.togglePanel", { panel: t("app.labels.bottomPanel") })}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
