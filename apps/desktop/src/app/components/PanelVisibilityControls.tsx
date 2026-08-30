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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
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
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <ResizablePanelControl panelId="workspace-sidebar">
                {({ isAvailable, isCollapsed }) => (
                  <DropdownMenuCheckboxItem checked={isAvailable && !isCollapsed} inset keepOpen>
                    {t("app.actions.showPanel", { panel: t("app.labels.leftPanel") })}
                    <DropdownMenuIcon side="right">
                      <PanelLeft aria-hidden="true" className="size-3" />
                    </DropdownMenuIcon>
                  </DropdownMenuCheckboxItem>
                )}
              </ResizablePanelControl>
              <ResizablePanelControl panelId="editor-stage-audio">
                {({ isAvailable, isCollapsed, isDisabled }) => (
                  <DropdownMenuCheckboxItem
                    checked={isAvailable && !isCollapsed}
                    disabled={!isAvailable || isDisabled}
                    inset
                    keepOpen
                  >
                    {t("app.actions.showPanel", { panel: t("app.labels.bottomPanel") })}
                    <DropdownMenuIcon side="right">
                      <PanelBottom aria-hidden="true" className="size-3" />
                    </DropdownMenuIcon>
                  </DropdownMenuCheckboxItem>
                )}
              </ResizablePanelControl>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <ResizablePanelControl
                mode="reset"
                panelId={["workspace-sidebar", "editor-stage-timeline"]}
              >
                {({ isDisabled }) => (
                  <DropdownMenuItem disabled={isDisabled} inset keepOpen>
                    <DropdownMenuIcon>
                      <RotateCcw aria-hidden="true" className="size-3" />
                    </DropdownMenuIcon>
                    {t("app.actions.resetLayout")}
                  </DropdownMenuItem>
                )}
              </ResizablePanelControl>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>{t("app.tooltips.customizeLayout")}</TooltipContent>
      </Tooltip>
      <Tooltip preserveOnTrigger>
        <ResizablePanelControl panelId="workspace-sidebar">
          {({ isCollapsed }) => (
            <TooltipTrigger asChild>
              <Button
                aria-label={t("app.tooltips.togglePanel", {
                  panel: t("app.labels.leftPanel"),
                })}
                className="size-7 p-0 text-secondary-foreground"
                size="icon-sm"
                variant="ghost"
              >
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
          {({ isAvailable, isCollapsed, isDisabled }) => (
            <TooltipTrigger asChild>
              <Button
                aria-label={t("app.tooltips.togglePanel", {
                  panel: t("app.labels.bottomPanel"),
                })}
                className="size-7 p-0 text-secondary-foreground"
                disabled={!isAvailable || isDisabled}
                size="icon-sm"
                variant="ghost"
              >
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
