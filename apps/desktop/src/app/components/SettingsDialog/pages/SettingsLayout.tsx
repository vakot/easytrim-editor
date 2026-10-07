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
    default: t("settings.layout.activityFeedView.options.default"),
    compact: t("settings.layout.activityFeedView.options.compact"),
    branch: t("settings.layout.activityFeedView.options.branch"),
  };

  return (
    <SettingsSection title={t("settings.layout.panels.label")}>
      <SettingRow label={t("layout.leftPanel")}>
        <CommandSwitch aria-label={t("layout.leftPanel")} commandId="toggle-left-panel" />
      </SettingRow>

      <SettingRow label={t("layout.bottomPanel")}>
        <CommandSwitch aria-label={t("layout.bottomPanel")} commandId="toggle-bottom-panel" />
      </SettingRow>

      <SettingRow label={t("layout.layoutDensity")}>
        <Select
          onValueChange={(value) =>
            void executeCommand(
              `layout-density-${value}` as "layout-density-default" | "layout-density-compact",
              "dialog",
            )
          }
          value={layoutDensity}
        >
          <SelectTrigger aria-label={t("layout.layoutDensity")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("layout.density.default")}</SelectItem>
            <SelectItem value="compact">{t("layout.density.compact")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label={t("settings.layout.activityFeedView.label")}>
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
          <SelectTrigger aria-label={t("settings.layout.activityFeedView.label")} className="w-44">
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

      <SettingRow label={t("settings.layout.reset")}>
        <CommandButton commandId="reset-layout" variant="destructive" />
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsLayout };
