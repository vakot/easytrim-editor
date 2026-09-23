import {
  LayoutPanelLeft,
  LayoutTemplate,
  List,
  ListTree,
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
  PanelsLeftBottom,
  RotateCcw,
  ScanText,
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizablePanelControl } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { isLayoutDensity } from "@/app/layout/lib/layout-density";
import type { ActivityFeedView } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  activityFeedViewChanged,
  layoutDensityChanged,
  selectActivityFeedView,
  selectLayoutDensity,
} from "@/app/store/slices/preferences-slice";

function AppLayoutControls() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const activityFeedView = useAppSelector(selectActivityFeedView);

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
              <DropdownMenuLabel>{t("app.labels.panelsVisibility")}</DropdownMenuLabel>

              <ResizablePanelControl panelId="workspace-sidebar">
                {({ isAvailable, isCollapsed }) => (
                  <DropdownMenuCheckboxItem checked={isAvailable && !isCollapsed} inset keepOpen>
                    {t("app.actions.showPanel", { panel: t("app.labels.leftPanel") })}
                    <DropdownMenuIcon side="right">
                      <PanelLeft aria-hidden="true" />
                    </DropdownMenuIcon>
                  </DropdownMenuCheckboxItem>
                )}
              </ResizablePanelControl>

              <ResizablePanelControl panelId="editor-stage-timeline">
                {({ isAvailable, isCollapsed, isDisabled }) => (
                  <DropdownMenuCheckboxItem
                    checked={isAvailable && !isCollapsed}
                    disabled={!isAvailable || isDisabled}
                    inset
                    keepOpen
                  >
                    {t("app.actions.showPanel", { panel: t("app.labels.bottomPanel") })}
                    <DropdownMenuIcon side="right">
                      <PanelBottom aria-hidden="true" />
                    </DropdownMenuIcon>
                  </DropdownMenuCheckboxItem>
                )}
              </ResizablePanelControl>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("app.labels.layoutDensity")}</DropdownMenuLabel>

              <DropdownMenuRadioGroup
                onValueChange={(value) => {
                  if (isLayoutDensity(value)) dispatch(layoutDensityChanged(value));
                }}
                value={layoutDensity}
              >
                <DropdownMenuRadioItem inset keepOpen value="default">
                  {t("app.options.layoutDensities.default")}
                  <DropdownMenuIcon side="right">
                    <LayoutTemplate aria-hidden="true" className="-scale-x-100 -rotate-90" />
                  </DropdownMenuIcon>
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem inset keepOpen value="compact">
                  {t("app.options.layoutDensities.compact")}
                  <DropdownMenuIcon side="right">
                    <PanelsLeftBottom aria-hidden="true" />
                  </DropdownMenuIcon>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("settings.labels.activityFeedView")}</DropdownMenuLabel>

              <DropdownMenuRadioGroup
                onValueChange={(value) =>
                  void dispatch(activityFeedViewChanged(value as ActivityFeedView))
                }
                value={activityFeedView}
              >
                <DropdownMenuRadioItem inset keepOpen value="default">
                  {t("settings.options.activityFeedViews.default")}
                  <DropdownMenuIcon side="right">
                    <List aria-hidden="true" />
                  </DropdownMenuIcon>
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem inset keepOpen value="compact">
                  {t("settings.options.activityFeedViews.compact")}
                  <DropdownMenuIcon side="right">
                    <ScanText aria-hidden="true" />
                  </DropdownMenuIcon>
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem inset keepOpen value="branch">
                  {t("settings.options.activityFeedViews.branch")}
                  <DropdownMenuIcon side="right">
                    <ListTree aria-hidden="true" />
                  </DropdownMenuIcon>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
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
        <ResizablePanelControl panelId="editor-stage-timeline">
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

export { AppLayoutControls };
