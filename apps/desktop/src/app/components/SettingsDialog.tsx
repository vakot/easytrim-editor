import type { TFunction } from "i18next";
import { Languages, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ColorSample, SpectrumWheel } from "@/components/ui/color";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Library,
  LibraryContent,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryPage,
  LibrarySeparator,
} from "@/components/ui/library";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { getPrimaryColorCommandId, getThemeCommandId } from "@/app/commands/appearance";
import { getQueueFinishCommandId } from "@/app/commands/queue";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import { MAX_UI_SCALE_PERCENT, MIN_UI_SCALE_PERCENT } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import {
  customPrimaryColorChanged,
  primaryColorChanged,
  selectActivityFeedView,
  selectCustomPrimaryColor,
  selectDeleteSourceOnRenderFinish,
  selectLayoutDensity,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectThemePreference,
  selectUiScalePercent,
} from "@/app/store/slices/preferences-slice";
import {
  CUSTOM_PRIMARY_COLOR,
  isCustomPrimaryColor,
  PRIMARY_COLORS,
  type PrimaryColor,
  resolvePrimaryColor,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/useTheme";
import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { LANGUAGE_CATALOG } from "@/domain/languages";
import { isSupportedLanguage } from "@/i18n/resources";
import { getCurrentVersion } from "@/lib/app-version.utils";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

const supportedLanguages = LANGUAGE_CATALOG.filter(({ code }) => isSupportedLanguage(code));

type SettingsPageId = "general" | "appearance" | "defaults" | "layout" | "queue" | "about";

function SettingsDialog() {
  const { t } = useTranslation();
  const { closeSettings, isSettingsOpen } = useSettingsDialog();
  const [selectedPage, setSelectedPage] = useState<SettingsPageId>("general");

  return (
    <Dialog onOpenChange={(open) => !open && closeSettings()} open={isSettingsOpen}>
      <DialogContent className="grid h-[min(48rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{t("settings.labels.title")}</DialogTitle>
          <DialogDescription>{t("settings.pages.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <Library
          className="mx-0 min-h-0 gap-4 px-5 sm:gap-6 sm:px-6"
          onValueChange={(value) => setSelectedPage(value as SettingsPageId)}
          value={selectedPage}
        >
          <LibraryNavigation
            aria-label={t("settings.pages.navigationLabel")}
            className="w-full items-stretch"
            containerClassName="w-[7.75rem] shrink-0 sm:w-44"
          >
            <LibraryNavigationGroup label={t("settings.pages.groups.preferences")}>
              <SettingsPageItem page="general" />
              <SettingsPageItem page="appearance" />
              <SettingsPageItem page="defaults" />
            </LibraryNavigationGroup>
            <LibraryNavigationGroup label={t("settings.pages.groups.workspace")}>
              <SettingsPageItem page="layout" />
              <SettingsPageItem page="queue" />
            </LibraryNavigationGroup>
            <LibraryNavigationGroup label={t("settings.pages.groups.about")}>
              <SettingsPageItem page="about" />
            </LibraryNavigationGroup>
          </LibraryNavigation>
          <LibrarySeparator />
          <LibraryContent className="px-2 sm:px-3">
            <SettingsPage hidden={selectedPage !== "general"} page="general">
              <GeneralSettings />
            </SettingsPage>
            <SettingsPage hidden={selectedPage !== "appearance"} page="appearance">
              <AppearanceSettings />
            </SettingsPage>
            <SettingsPage hidden={selectedPage !== "defaults"} page="defaults">
              <DefaultsSettings />
            </SettingsPage>
            <SettingsPage hidden={selectedPage !== "layout"} page="layout">
              <LayoutSettings />
            </SettingsPage>
            <SettingsPage hidden={selectedPage !== "queue"} page="queue">
              <QueueSettings />
            </SettingsPage>
            <SettingsPage hidden={selectedPage !== "about"} page="about">
              <AboutSettings />
            </SettingsPage>
          </LibraryContent>
        </Library>
      </DialogContent>
    </Dialog>
  );
}

function SettingsPageItem({ page }: { page: SettingsPageId }) {
  const { t } = useTranslation();
  return (
    <LibraryNavigationItem className="px-3" value={page}>
      {getSettingsPageTitle(t, page)}
    </LibraryNavigationItem>
  );
}

function SettingsPage({
  children,
  hidden,
  page,
}: {
  children: ReactNode;
  hidden: boolean;
  page: SettingsPageId;
}) {
  const { t } = useTranslation();
  return (
    <LibraryPage hidden={hidden} value={page}>
      <div className="space-y-1 border-b pb-5">
        <h2 className="text-lg font-semibold">{getSettingsPageTitle(t, page)}</h2>
        <p className="text-sm text-muted-foreground">{getSettingsPageDescription(t, page)}</p>
      </div>
      <div className="divide-y divide-border/70">{children}</div>
    </LibraryPage>
  );
}

function getSettingsPageTitle(t: TFunction, page: SettingsPageId) {
  switch (page) {
    case "general":
      return t("settings.pages.general.title");
    case "appearance":
      return t("settings.pages.appearance.title");
    case "defaults":
      return t("settings.pages.defaults.title");
    case "layout":
      return t("settings.pages.layout.title");
    case "queue":
      return t("settings.pages.queue.title");
    case "about":
      return t("settings.pages.about.title");
  }
}

function getSettingsPageDescription(t: TFunction, page: SettingsPageId) {
  switch (page) {
    case "general":
      return t("settings.pages.general.description");
    case "appearance":
      return t("settings.pages.appearance.description");
    case "defaults":
      return t("settings.pages.defaults.description");
    case "layout":
      return t("settings.pages.layout.description");
    case "queue":
      return t("settings.pages.queue.description");
    case "about":
      return t("settings.pages.about.description");
  }
}

function SettingRow({
  children,
  description,
  destructive = false,
  label,
}: {
  children: ReactNode;
  description?: string;
  destructive?: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div
          className={destructive ? "text-sm font-medium text-destructive" : "text-sm font-medium"}
        >
          {label}
        </div>
        {description ? (
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:pl-4">{children}</div>
    </div>
  );
}

function CommandSwitch({
  commandId,
  description,
  label,
}: {
  commandId: Parameters<typeof useApplicationCommand>[0];
  description?: string;
  label: string;
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();
  return (
    <SettingRow description={description} label={label}>
      <Switch
        aria-label={label}
        checked={Boolean(command.checked)}
        disabled={!command.enabled || command.pending}
        onCheckedChange={() => void executeCommand(command.id, "dialog")}
      />
    </SettingRow>
  );
}

function CommandButton({
  commandId,
  label,
  variant = "outline",
}: {
  commandId: Parameters<typeof useApplicationCommand>[0];
  label?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();
  return (
    <Button
      disabled={!command.enabled || command.pending}
      onClick={() => void executeCommand(command.id, "dialog")}
      type="button"
      variant={variant}
    >
      {label ?? command.label}
    </Button>
  );
}

function GeneralSettings() {
  const { i18n, t } = useTranslation();
  const language = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
  return (
    <SettingRow
      description={t("settings.pages.general.languageDescription")}
      label={t("settings.labels.language")}
    >
      <LanguageSelector
        languages={supportedLanguages}
        onValueChange={(nextLanguage) => {
          if (isSupportedLanguage(nextLanguage)) void i18n.changeLanguage(nextLanguage);
        }}
        value={language}
      >
        <LanguageSelectorTrigger>
          <Button
            aria-label={t("settings.labels.language")}
            className="w-44 justify-start"
            type="button"
            variant="outline"
          >
            <Languages aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">
              <LanguageSelectorValue />
            </span>
          </Button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput
            aria-label={t("common.labels.searchLanguages")}
            placeholder={t("common.labels.searchLanguages")}
          />
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>
    </SettingRow>
  );
}

function AppearanceSettings() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const scale = useAppSelector(selectUiScalePercent);
  const theme = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);
  const primaryColorKey = useAppSelector(selectPrimaryColorKey);
  const colorLabels = {
    amber: t("settings.options.colors.amber"),
    blue: t("settings.options.colors.blue"),
    emerald: t("settings.options.colors.emerald"),
    rose: t("settings.options.colors.rose"),
    violet: t("settings.options.colors.violet"),
  };

  const themeOptions = [
    {
      id: "system",
      icon: <Monitor aria-hidden="true" />,
      label: t("settings.options.themes.system"),
    },
    { id: "light", icon: <Sun aria-hidden="true" />, label: t("settings.options.themes.light") },
    { id: "dark", icon: <Moon aria-hidden="true" />, label: t("settings.options.themes.dark") },
  ] as const;

  return (
    <>
      <SettingRow
        description={t("settings.pages.appearance.scalingDescription")}
        label={t("app.labels.uiScaling")}
      >
        <Button
          aria-label={t("app.actions.zoomOut")}
          disabled={scale <= MIN_UI_SCALE_PERCENT}
          onClick={() => void executeCommand("ui-scale-zoom-out", "dialog")}
          size="icon-sm"
          variant="outline"
        >
          −
        </Button>
        <span className="w-12 text-center text-sm tabular-nums">{scale}%</span>
        <Button
          aria-label={t("app.actions.zoomIn")}
          disabled={scale >= MAX_UI_SCALE_PERCENT}
          onClick={() => void executeCommand("ui-scale-zoom-in", "dialog")}
          size="icon-sm"
          variant="outline"
        >
          +
        </Button>
        <CommandButton commandId="ui-scale-reset" label={t("app.actions.zoomReset")} />
      </SettingRow>
      <SettingRow label={t("settings.labels.theme")}>
        <Select
          onValueChange={(value) =>
            void executeCommand(getThemeCommandId(value as "system" | "light" | "dark"), "dialog")
          }
          value={theme}
        >
          <SelectTrigger aria-label={t("settings.labels.theme")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {themeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.icon}
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow
        description={t("settings.pages.appearance.colorDescription")}
        label={t("settings.labels.color")}
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {PRIMARY_COLORS.map((color) => (
            <Button
              aria-label={colorLabels[color]}
              aria-pressed={primaryColor === color}
              className="size-8 p-0"
              key={color}
              onClick={() => void executeCommand(getPrimaryColorCommandId(color), "dialog")}
              title={colorLabels[color]}
              variant={primaryColor === color ? "secondary" : "ghost"}
            >
              <ColorSample color={resolvePrimaryColor(color)} />
            </Button>
          ))}
          <CustomColorPopover
            color={customPrimaryColor}
            isSelected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
            label={t("settings.options.colors.custom")}
          />
        </div>
      </SettingRow>
      <ResetRow commandId="reset-view-settings" label={t("settings.pages.appearance.resetLabel")} />
    </>
  );
}

function CustomColorPopover({
  color,
  isSelected,
  label,
}: {
  color: PrimaryColor;
  isSelected: boolean;
  label: string;
}) {
  const { t } = useTranslation();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [previewColor, setPreviewColor] = useState<PrimaryColor | null>(null);
  const [hexValue, setHexValue] = useState(color.slice(1));
  const selectedColor = resolvePrimaryColor(previewColor ?? color);
  const close = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPreviewColor(null);
      setHexValue(color.slice(1));
      previewPrimaryColor(null);
    }
  };

  const preview = (next: PrimaryColor) => {
    setPreviewColor(next);
    setHexValue(resolvePrimaryColor(next).slice(1));
    previewPrimaryColor(next);
  };

  const commit = (next: PrimaryColor) => {
    setPreviewColor(null);
    setHexValue(resolvePrimaryColor(next).slice(1));
    if (isCustomPrimaryColor(next)) dispatch(customPrimaryColorChanged(next));
  };

  return (
    <Popover onOpenChange={close} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={isSelected}
          className="gap-1.5 px-2"
          onClick={() => dispatch(primaryColorChanged(color))}
          variant={isSelected ? "secondary" : "ghost"}
        >
          <ColorSample color={resolvePrimaryColor(color)} />
          <span className="text-xs">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto space-y-3 p-3">
        <SpectrumWheel
          aria-label={t("settings.accessibility.colorSpectrum")}
          color={selectedColor}
          onCancel={() => close(false)}
          onCommit={commit}
          onPreview={preview}
        />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{label}</span>
          <div className="flex h-7 w-24 items-center rounded-lg border border-input px-1.5 focus-within:ring-3 focus-within:ring-ring/50">
            <span aria-hidden="true">#</span>
            <Input
              aria-label={t("settings.accessibility.customColorHex")}
              className="h-full border-0 p-0 font-mono text-xs shadow-none focus-visible:ring-0"
              maxLength={6}
              onChange={(event) => {
                const value = event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                setHexValue(value);
                const next = `#${value}`;
                if (isCustomPrimaryColor(next)) commit(next);
              }}
              pattern="[0-9a-fA-F]{6}"
              spellCheck={false}
              value={hexValue}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DefaultsSettings() {
  const { t } = useTranslation();
  return (
    <>
      <CommandSwitch
        commandId="preference-loop-playback"
        description={t("settings.pages.defaults.loopDescription")}
        label={t("settings.labels.loop")}
      />
      <CommandSwitch
        commandId="preference-segment-playback"
        description={t("settings.pages.defaults.followSegmentDescription")}
        label={t("settings.labels.followSegment")}
      />
      <CommandSwitch
        commandId="preference-merge-audio"
        description={t("settings.pages.defaults.mergeAudioDescription")}
        label={t("settings.labels.mergeAudio")}
      />
      <ResetRow commandId="reset-preferences" label={t("settings.pages.defaults.resetLabel")} />
    </>
  );
}

function LayoutSettings() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const activityFeedViewLabels = {
    default: t("settings.options.activityFeedViews.default"),
    compact: t("settings.options.activityFeedViews.compact"),
    branch: t("settings.options.activityFeedViews.branch"),
  };

  return (
    <>
      <CommandSwitch commandId="toggle-left-panel" label={t("app.labels.leftPanel")} />
      <CommandSwitch commandId="toggle-bottom-panel" label={t("app.labels.bottomPanel")} />
      <SettingRow label={t("app.labels.layoutDensity")}>
        <Select
          onValueChange={(value) =>
            void executeCommand(
              `layout-density-${value}` as "layout-density-default" | "layout-density-compact",
              "dialog",
            )
          }
          value={layoutDensity}
        >
          <SelectTrigger aria-label={t("app.labels.layoutDensity")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("app.options.layoutDensities.default")}</SelectItem>
            <SelectItem value="compact">{t("app.options.layoutDensities.compact")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label={t("settings.labels.activityFeedView")}>
        <Select
          onValueChange={(value) =>
            void executeCommand(
              `activity-feed-view-${value}` as
                | "activity-feed-view-default"
                | "activity-feed-view-compact"
                | "activity-feed-view-branch",
              "dialog",
            )
          }
          value={activityFeedView}
        >
          <SelectTrigger aria-label={t("settings.labels.activityFeedView")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["default", "compact", "branch"] as const).map((view) => (
              <SelectItem key={view} value={view}>
                {activityFeedViewLabels[view]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <div className="py-4">
        <CommandButton
          commandId="reset-layout"
          label={t("settings.pages.layout.resetLabel")}
          variant="destructive"
        />
      </div>
    </>
  );
}

function QueueSettings() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);
  const deleteSource = useAppSelector(selectDeleteSourceOnRenderFinish);
  const deleteSourceCommand = useApplicationCommand("delete-source-on-render-finish");
  return (
    <>
      <CommandSwitch
        commandId="preference-auto-start-queue"
        description={t("settings.pages.queue.autoStartDescription")}
        label={t("settings.labels.autoStartQueue")}
      />
      <SettingRow
        description={t("queue.tooltips.deleteSourceOnRenderFinish")}
        destructive={deleteSource}
        label={t("queue.labels.deleteSource")}
      >
        <Switch
          aria-label={t("queue.labels.deleteSource")}
          checked={deleteSource}
          disabled={!deleteSourceCommand.enabled || deleteSourceCommand.pending}
          onCheckedChange={() => void executeCommand("delete-source-on-render-finish", "dialog")}
        />
      </SettingRow>
      <SettingRow
        description={t("settings.pages.queue.onFinishedDescription")}
        label={t("queue.labels.onFinish")}
      >
        <Select
          onValueChange={(value) =>
            void executeCommand(getQueueFinishCommandId(value as QueueFinishAction), "dialog")
          }
          value={queueFinishAction}
        >
          <SelectTrigger aria-label={t("queue.labels.onFinish")} className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableQueueFinishActions.map((action) => (
              <QueueFinishSelectItem action={action} key={action} />
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label={t("queue.actions.openExportQueue")}>
        <CommandButton commandId="open-export-queue" label={t("queue.actions.openExportQueue")} />
      </SettingRow>
      <div className="py-4">
        <CommandButton
          commandId="reset-queue-settings"
          label={t("settings.pages.queue.resetLabel")}
          variant="destructive"
        />
      </div>
    </>
  );
}

function QueueFinishSelectItem({ action }: { action: QueueFinishAction }) {
  const command = useApplicationCommand(getQueueFinishCommandId(action));
  return (
    <SelectItem disabled={!command.enabled} value={action}>
      {command.label}
    </SelectItem>
  );
}

function AboutSettings() {
  const { t } = useTranslation();
  return (
    <>
      <SettingRow
        description={t("settings.pages.about.versionDescription")}
        label={t("settings.pages.about.versionLabel")}
      >
        <span className="text-sm tabular-nums">
          {t("app.labels.version", { version: getCurrentVersion() })}
        </span>
        <CommandButton
          commandId="open-release-page"
          label={t("settings.pages.about.openRelease")}
        />
      </SettingRow>
      <SettingRow
        description={t("settings.pages.about.updatesDescription")}
        label={t("settings.pages.about.updatesLabel")}
      >
        <CommandButton commandId="check-for-updates" variant="default" />
      </SettingRow>
      <SettingRow label={t("support.actions.changelog")}>
        <CommandButton commandId="open-changelog" />
      </SettingRow>
      <SettingRow label={t("support.actions.projectPage")}>
        <CommandButton commandId="open-project-page" />
      </SettingRow>
      <SettingRow label={t("support.actions.showLogs")}>
        <CommandButton commandId="show-logs" />
      </SettingRow>
      <SettingRow label={t("support.actions.projectSupport")}>
        <CommandButton commandId="support-project" />
      </SettingRow>
    </>
  );
}

function ResetRow({
  commandId,
  label,
}: {
  commandId: "reset-preferences" | "reset-view-settings";
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="py-4">
      <CommandButton commandId={commandId} label={label} variant="destructive" />
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <RotateCcw aria-hidden="true" className="size-3" />
        {t("settings.pages.resetImmediateDescription")}
      </p>
    </div>
  );
}

export { SettingsDialog };
