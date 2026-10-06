import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView, selectLayoutDensity } from "@/app/store/slices/preferences-slice";

import {
  CommandButton,
  CommandSwitch,
  SettingRow,
  SettingsSection,
} from "../components/SettingRow";

function SettingsLayout() {
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
    <SettingsSection title={t("settings.labels.panels")}>
      <SettingRow label={t("app.labels.leftPanel")}>
        <CommandSwitch commandId="toggle-left-panel" />
      </SettingRow>

      <SettingRow label={t("app.labels.bottomPanel")}>
        <CommandSwitch commandId="toggle-bottom-panel" />
      </SettingRow>

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

      <SettingRow label={t("settings.pages.layout.resetLabel")}>
        <CommandButton commandId="reset-layout" variant="destructive" />
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsLayout };
