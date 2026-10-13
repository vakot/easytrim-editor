import { useTranslation } from "react-i18next";

import { KofiIcon } from "@/components/brand-icons";
import { getCurrentVersion } from "@/lib/app-version.utils";

import { CommandButton, SettingRow, SettingsSection } from "../components/SettingRow";

function SettingsAbout() {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSection title={t("settings.about.support.title")}>
        <SettingRow
          description={t("support.project.messages.buyMeCoffee")}
          label={t("support.project.actions.projectSupport")}
        >
          <CommandButton commandId="support-project" variant="link">
            <KofiIcon aria-hidden="true" className="size-4" />
            {t("support.project.actions.projectSupport")}
          </CommandButton>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.about.updates.label")}>
        <SettingRow
          description={t("settings.about.version.description")}
          label={t("app.version", { version: getCurrentVersion() })}
        >
          <CommandButton commandId="open-release-page" variant="outline" />
        </SettingRow>

        <SettingRow
          description={t("settings.about.updates.description")}
          label={t("settings.about.updates.label")}
        >
          <CommandButton commandId="check-for-updates" variant="default" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.about.more.title")}>
        <SettingRow label={t("support.project.actions.projectPage")}>
          <CommandButton commandId="open-project-page" variant="outline" />
        </SettingRow>

        <SettingRow label={t("support.project.actions.showLogs")}>
          <CommandButton commandId="show-logs" variant="outline" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("support.whatsNew.title")}>
        <SettingRow label={t("support.changelog.open")}>
          <CommandButton commandId="open-changelog" variant="outline" />
        </SettingRow>
      </SettingsSection>
    </>
  );
}

export { SettingsAbout };
