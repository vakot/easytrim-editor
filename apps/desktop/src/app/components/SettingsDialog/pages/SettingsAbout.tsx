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
      <SettingsSection title="Support">
        <SettingRow description="Buy me a coffee" label={t("support.actions.projectSupport")}>
          <CommandButton commandId="support-project" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Updates">
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

        <SettingRow description="TODO: use beta" label="Strategy">
          <Select defaultValue="production">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="beta">Beta</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="More">
        <SettingRow label={t("support.actions.projectPage")}>
          <CommandButton commandId="open-project-page" />
        </SettingRow>

        <SettingRow label={t("support.actions.showLogs")}>
          <CommandButton commandId="show-logs" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="What's new">
        <SettingRow label={t("support.actions.changelog")}>
          <CommandButton commandId="open-changelog" />
        </SettingRow>
      </SettingsSection>
    </>
  );
}

export { SettingsAbout };
