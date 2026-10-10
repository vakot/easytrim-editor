import {
  LayoutPanelLeft,
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
  PanelRight,
  PanelRightDashed,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function AppLayoutControls() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const leftPanel = useApplicationCommand("toggle-left-panel");
  const rightPanel = useApplicationCommand("toggle-right-panel");
  const bottomPanel = useApplicationCommand("toggle-bottom-panel");
  const activityFeedDefault = useApplicationCommand("activity-feed-view-default");
  const activityFeedCompact = useApplicationCommand("activity-feed-view-compact");
  const activityFeedBranch = useApplicationCommand("activity-feed-view-branch");
  const layoutDensity = useApplicationCommand("layout-density-default").checked
    ? "default"
    : "compact";

  const activityFeedView = activityFeedDefault.checked
    ? "default"
    : activityFeedCompact.checked
      ? "compact"
      : activityFeedBranch.checked
        ? "branch"
        : "default";

  return (
    <div
      aria-label={t("layout.accessibility.panels")}
      className="flex items-center gap-0.5"
      role="group"
    >
      <Tooltip>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("layout.accessibility.layoutControls")}
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
              <DropdownMenuLabel>{t("layout.panelsVisibility")}</DropdownMenuLabel>

              <ApplicationCommandMenuItem asChild commandId="toggle-left-panel">
                <DropdownMenuCheckboxItem inset keepOpen>
                  <ApplicationCommandLabel />
                  <DropdownMenuIcon side="right">
                    <ApplicationCommandIcon />
                  </DropdownMenuIcon>
                </DropdownMenuCheckboxItem>
              </ApplicationCommandMenuItem>

              <ApplicationCommandMenuItem asChild commandId="toggle-right-panel">
                <DropdownMenuCheckboxItem inset keepOpen>
                  <ApplicationCommandLabel />
                  <DropdownMenuIcon side="right">
                    <ApplicationCommandIcon />
                  </DropdownMenuIcon>
                </DropdownMenuCheckboxItem>
              </ApplicationCommandMenuItem>

              <ApplicationCommandMenuItem asChild commandId="toggle-bottom-panel">
                <DropdownMenuCheckboxItem inset keepOpen>
                  <ApplicationCommandLabel />
                  <DropdownMenuIcon side="right">
                    <ApplicationCommandIcon />
                  </DropdownMenuIcon>
                </DropdownMenuCheckboxItem>
              </ApplicationCommandMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("layout.layoutDensity")}</DropdownMenuLabel>

              <DropdownMenuRadioGroup value={layoutDensity}>
                <ApplicationCommandMenuItem asChild commandId="layout-density-default">
                  <DropdownMenuRadioItem inset keepOpen value="default">
                    <ApplicationCommandLabel />
                    <DropdownMenuIcon side="right">
                      <ApplicationCommandIcon />
                    </DropdownMenuIcon>
                  </DropdownMenuRadioItem>
                </ApplicationCommandMenuItem>

                <ApplicationCommandMenuItem asChild commandId="layout-density-compact">
                  <DropdownMenuRadioItem inset keepOpen value="compact">
                    <ApplicationCommandLabel />
                    <DropdownMenuIcon side="right">
                      <ApplicationCommandIcon />
                    </DropdownMenuIcon>
                  </DropdownMenuRadioItem>
                </ApplicationCommandMenuItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("settings.layout.activityFeedView.label")}</DropdownMenuLabel>

              <DropdownMenuRadioGroup value={activityFeedView ?? "default"}>
                <ApplicationCommandMenuItem asChild commandId="activity-feed-view-default">
                  <DropdownMenuRadioItem inset keepOpen value="default">
                    <ApplicationCommandLabel />
                    <DropdownMenuIcon side="right">
                      <ApplicationCommandIcon />
                    </DropdownMenuIcon>
                  </DropdownMenuRadioItem>
                </ApplicationCommandMenuItem>

                <ApplicationCommandMenuItem asChild commandId="activity-feed-view-compact">
                  <DropdownMenuRadioItem inset keepOpen value="compact">
                    <ApplicationCommandLabel />
                    <DropdownMenuIcon side="right">
                      <ApplicationCommandIcon />
                    </DropdownMenuIcon>
                  </DropdownMenuRadioItem>
                </ApplicationCommandMenuItem>

                <ApplicationCommandMenuItem asChild commandId="activity-feed-view-branch">
                  <DropdownMenuRadioItem inset keepOpen value="branch">
                    <ApplicationCommandLabel />
                    <DropdownMenuIcon side="right">
                      <ApplicationCommandIcon />
                    </DropdownMenuIcon>
                  </DropdownMenuRadioItem>
                </ApplicationCommandMenuItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <ApplicationCommandMenuItem asChild commandId="reset-layout">
                <DropdownMenuItem inset keepOpen>
                  <DropdownMenuIcon>
                    <ApplicationCommandIcon className="size-3" />
                  </DropdownMenuIcon>
                  <ApplicationCommandLabel />
                </DropdownMenuItem>
              </ApplicationCommandMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>{t("layout.accessibility.layoutControls")}</TooltipContent>
      </Tooltip>

      <Tooltip preserveOnTrigger>
        <TooltipTrigger asChild>
          <Button
            aria-label={t("layout.toggleRightPanel")}
            className="size-7 p-0 text-secondary-foreground"
            disabled={!rightPanel.enabled || rightPanel.pending}
            onClick={() => void executeCommand("toggle-right-panel", "button")}
            size="icon-sm"
            variant="ghost"
          >
            {!rightPanel.checked ? (
              <PanelRightDashed aria-hidden="true" />
            ) : (
              <PanelRight aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("layout.toggleRightPanel")}</TooltipContent>
      </Tooltip>

      <Tooltip preserveOnTrigger>
        <TooltipTrigger asChild>
          <Button
            aria-label={t("layout.toggleLeftPanel")}
            className="size-7 p-0 text-secondary-foreground"
            disabled={!leftPanel.enabled || leftPanel.pending}
            onClick={() => void executeCommand("toggle-left-panel", "button")}
            size="icon-sm"
            variant="ghost"
          >
            {!leftPanel.checked ? (
              <PanelLeftDashed aria-hidden="true" />
            ) : (
              <PanelLeft aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("layout.toggleLeftPanel")}</TooltipContent>
      </Tooltip>

      <Tooltip preserveOnTrigger>
        <TooltipTrigger asChild>
          <Button
            aria-label={t("layout.toggleBottomPanel")}
            className="size-7 p-0 text-secondary-foreground"
            disabled={!bottomPanel.enabled || bottomPanel.pending}
            onClick={() => void executeCommand("toggle-bottom-panel", "button")}
            size="icon-sm"
            variant="ghost"
          >
            {!bottomPanel.checked ? (
              <PanelBottomDashed aria-hidden="true" />
            ) : (
              <PanelBottom aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("layout.toggleBottomPanel")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export { AppLayoutControls };
