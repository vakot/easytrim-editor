import { Monitor, Moon, Sun, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { getPrimaryColorCommandId, getThemeCommandId } from "@/app/commands/appearance";
import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
  ApplicationCommandShortcut,
} from "@/app/components/ApplicationCommandMenuItem";
import { useCommandPalette } from "@/app/contexts/command-palette-context";
import { useApplicationCommand } from "@/app/hooks/useApplicationCommands";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueueSummary } from "@/app/store/slices/editing-instances-slice";
import {
  selectPrimaryColor,
  selectThemePreference,
  selectUiScalePercent,
} from "@/app/store/slices/preferences-slice";
import { PRIMARY_COLOR_PRESETS } from "@/app/theme/theme";
import { ColorSample } from "@/components/color";

const themeIcons = {
  system: <Monitor aria-hidden="true" />,
  light: <Sun aria-hidden="true" />,
  dark: <Moon aria-hidden="true" />,
} as const;

function MenuBarView() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="view">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("layout.view")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenuBarViewContent />
      </MenubarContent>
    </MenubarMenu>
  );
}

function MenuBarViewContent() {
  const { t } = useTranslation();
  const { openCommandPalette } = useCommandPalette();

  const queueSummary = useAppSelector(selectExportQueueSummary);
  const finishedExports = queueSummary.completed + queueSummary.failed;
  const queueSize = finishedExports + queueSummary.queued + queueSummary.rendering;

  return (
    <>
      <MenubarGroup>
        <MenubarItem onSelect={() => openCommandPalette()}>
          {t("commands.title")}
          <MenubarShortcut>
            <Kbd>/</Kbd>
          </MenubarShortcut>
        </MenubarItem>

        <ApplicationCommandMenuItem asChild commandId="open-export-queue">
          <MenubarItem>
            {t("queue.title")}
            <MenubarShortcut className="text-xs">
              {finishedExports}/{queueSize}
            </MenubarShortcut>
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>

      <MenubarSeparator />

      <MenubarGroup>
        <MenubarSub>
          <MenubarSubTrigger>{t("settings.appearance.title")}</MenubarSubTrigger>

          <MenubarSubContent>
            <MenuBarViewAppearance />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSub>
          <MenubarSubTrigger>{t("settings.layout.title")}</MenubarSubTrigger>

          <MenubarSubContent>
            <MenuBarViewLayout />
          </MenubarSubContent>
        </MenubarSub>
      </MenubarGroup>
    </>
  );
}

function MenuBarViewAppearance() {
  const { t } = useTranslation();

  const preference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const uiScalePercent = useAppSelector(selectUiScalePercent);

  const currentThemeIcon = themeIcons[preference];

  return (
    <MenubarGroup>
      <MenubarSub>
        <MenubarSubTrigger inset>
          <MenubarIcon>
            <ZoomIn aria-hidden="true" />
          </MenubarIcon>
          {t("layout.uiScaling")}
          <MenubarShortcut>{uiScalePercent}%</MenubarShortcut>
        </MenubarSubTrigger>

        <MenubarSubContent>
          {(["ui-scale-zoom-in", "ui-scale-zoom-out"] as const).map((commandId) => (
            <ApplicationCommandMenuItem asChild commandId={commandId} key={commandId}>
              <MenubarItem keepOpen>
                <ApplicationCommandLabel />
                <ApplicationCommandShortcut />
              </MenubarItem>
            </ApplicationCommandMenuItem>
          ))}

          <MenubarSeparator />

          <ApplicationCommandMenuItem asChild commandId="ui-scale-reset">
            <MenubarItem keepOpen variant="destructive">
              <ApplicationCommandLabel />
              <ApplicationCommandShortcut />
            </MenubarItem>
          </ApplicationCommandMenuItem>
        </MenubarSubContent>
      </MenubarSub>

      <MenubarSub>
        <MenubarSubTrigger inset>
          <MenubarIcon>{currentThemeIcon}</MenubarIcon>
          {t("settings.appearance.theme.label")}
        </MenubarSubTrigger>

        <MenubarSubContent>
          <MenubarRadioGroup value={preference}>
            {(["system", "light", "dark"] as const).map((theme) => (
              <ApplicationCommandMenuItem asChild commandId={getThemeCommandId(theme)} key={theme}>
                <MenubarRadioItem inset keepOpen value={theme}>
                  <ApplicationCommandLabel />
                  <MenubarIcon side="right">
                    <ApplicationCommandIcon />
                  </MenubarIcon>
                </MenubarRadioItem>
              </ApplicationCommandMenuItem>
            ))}
          </MenubarRadioGroup>
        </MenubarSubContent>
      </MenubarSub>

      <MenubarSub>
        <MenubarSubTrigger inset>
          <MenubarIcon>
            <ColorSample aria-selected color={primaryColor} />
          </MenubarIcon>
          {t("settings.appearance.color.label")}
          <MenubarShortcut className="font-mono">{primaryColor.toUpperCase()}</MenubarShortcut>
        </MenubarSubTrigger>

        <MenubarSubContent>
          <MenubarRadioGroup value={primaryColor}>
            {PRIMARY_COLOR_PRESETS.map((preset) => (
              <ApplicationCommandMenuItem
                asChild
                commandId={getPrimaryColorCommandId(preset.id)}
                key={preset.id}
              >
                <MenubarRadioItem keepOpen value={preset.color}>
                  <ApplicationCommandLabel />
                  <MenubarShortcut className="flex items-center gap-2">
                    <span className="font-mono">{preset.color.toUpperCase()}</span>
                    <ApplicationCommandIcon />
                  </MenubarShortcut>
                </MenubarRadioItem>
              </ApplicationCommandMenuItem>
            ))}
          </MenubarRadioGroup>
        </MenubarSubContent>
      </MenubarSub>
    </MenubarGroup>
  );
}

function MenuBarViewLayout() {
  const { t } = useTranslation();
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
    <>
      <MenubarGroup>
        <MenubarLabel>{t("layout.panelsVisibility")}</MenubarLabel>

        <ApplicationCommandMenuItem asChild commandId="toggle-left-panel">
          <MenubarCheckboxItem inset keepOpen>
            <ApplicationCommandLabel />
            <MenubarIcon side="right">
              <ApplicationCommandIcon />
            </MenubarIcon>
          </MenubarCheckboxItem>
        </ApplicationCommandMenuItem>

        <ApplicationCommandMenuItem asChild commandId="toggle-bottom-panel">
          <MenubarCheckboxItem inset keepOpen>
            <ApplicationCommandLabel />
            <MenubarIcon side="right">
              <ApplicationCommandIcon />
            </MenubarIcon>
          </MenubarCheckboxItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>

      <MenubarSeparator />

      <MenubarGroup>
        <MenubarLabel>{t("layout.layoutDensity")}</MenubarLabel>

        <MenubarRadioGroup value={layoutDensity}>
          <ApplicationCommandMenuItem asChild commandId="layout-density-default">
            <MenubarRadioItem inset keepOpen value="default">
              <ApplicationCommandLabel />
              <MenubarIcon side="right">
                <ApplicationCommandIcon />
              </MenubarIcon>
            </MenubarRadioItem>
          </ApplicationCommandMenuItem>

          <ApplicationCommandMenuItem asChild commandId="layout-density-compact">
            <MenubarRadioItem inset keepOpen value="compact">
              <ApplicationCommandLabel />
              <MenubarIcon side="right">
                <ApplicationCommandIcon />
              </MenubarIcon>
            </MenubarRadioItem>
          </ApplicationCommandMenuItem>
        </MenubarRadioGroup>
      </MenubarGroup>

      <MenubarSeparator />

      <MenubarGroup>
        <MenubarLabel>{t("settings.layout.activityFeedView.label")}</MenubarLabel>

        <MenubarRadioGroup value={activityFeedView ?? "default"}>
          <ApplicationCommandMenuItem asChild commandId="activity-feed-view-default">
            <MenubarRadioItem inset keepOpen value="default">
              <ApplicationCommandLabel />
              <MenubarIcon side="right">
                <ApplicationCommandIcon />
              </MenubarIcon>
            </MenubarRadioItem>
          </ApplicationCommandMenuItem>

          <ApplicationCommandMenuItem asChild commandId="activity-feed-view-compact">
            <MenubarRadioItem inset keepOpen value="compact">
              <ApplicationCommandLabel />
              <MenubarIcon side="right">
                <ApplicationCommandIcon />
              </MenubarIcon>
            </MenubarRadioItem>
          </ApplicationCommandMenuItem>

          <ApplicationCommandMenuItem asChild commandId="activity-feed-view-branch">
            <MenubarRadioItem inset keepOpen value="branch">
              <ApplicationCommandLabel />
              <MenubarIcon side="right">
                <ApplicationCommandIcon />
              </MenubarIcon>
            </MenubarRadioItem>
          </ApplicationCommandMenuItem>
        </MenubarRadioGroup>
      </MenubarGroup>

      <MenubarSeparator />

      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="reset-layout">
          <MenubarItem inset keepOpen>
            <MenubarIcon>
              <ApplicationCommandIcon className="size-3" />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
    </>
  );
}

export { MenuBarView, MenuBarViewContent };
