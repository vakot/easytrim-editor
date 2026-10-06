import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getCurrentVersion } from "@/lib/app-version.utils";

import { CommandButton, SettingRow, SettingsSection } from "../components/SettingRow";

function SettingsAbout() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsSection title={t("settings.pages.about.supportSection")}>
        <SettingRow description={t("support.messages.buyMeCoffee")} label={t("support.actions.projectSupport")}>
          <CommandButton commandId="support-project" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.pages.about.updatesLabel")}>
        <SettingRow
          description={t("settings.pages.about.versionDescription")}
          label={t("app.labels.version", { version: getCurrentVersion() })}
        >
          <CommandButton commandId="open-release-page" />
        </SettingRow>

        <SettingRow
          description={t("settings.pages.about.updatesDescription")}
          label={t("settings.pages.about.updatesLabel")}
        >
          <CommandButton commandId="check-for-updates" variant="default" />
        </SettingRow>

        <SettingRow
          description={t("settings.pages.about.updateChannelDescription")}
          label={t("settings.labels.updateChannel")}
        >
          <Select defaultValue="production">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="production">
                  {t("settings.options.updateChannels.production")}
                </SelectItem>
                <SelectItem value="beta">{t("settings.options.updateChannels.beta")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.pages.about.moreSection")}>
        <SettingRow label={t("support.actions.projectPage")}>
          <CommandButton commandId="open-project-page" />
        </SettingRow>

        <SettingRow label={t("support.actions.showLogs")}>
          <CommandButton commandId="show-logs" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("support.labels.whatsNewTitle")}>
        <SettingRow label={t("support.actions.changelog")}>
          <CommandButton commandId="open-changelog" />
        </SettingRow>
      </SettingsSection>
    </>
  );
}

export { SettingsAbout };
