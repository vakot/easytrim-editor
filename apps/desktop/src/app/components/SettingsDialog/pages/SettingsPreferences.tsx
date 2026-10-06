import { useTranslation } from "react-i18next";

import { CommandReset, CommandSwitch, SettingRow, SettingsSection } from "../components/SettingRow";

function SettingsPreferences() {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("settings.pages.preferences.title")}>
      <SettingRow
        description={t("settings.pages.preferences.loopDescription")}
        label={t("settings.labels.loop")}
      >
        <CommandSwitch
          aria-label={t("settings.labels.loop")}
          commandId="preference-loop-playback"
        />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.preferences.followSegmentDescription")}
        label={t("settings.labels.followSegment")}
      >
        <CommandSwitch
          aria-label={t("settings.labels.followSegment")}
          commandId="preference-segment-playback"
        />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.preferences.mergeAudioDescription")}
        label={t("settings.labels.mergeAudio")}
      >
        <CommandSwitch
          aria-label={t("settings.labels.mergeAudio")}
          commandId="preference-merge-audio"
        />
      </SettingRow>

      <SettingRow label={t("settings.pages.preferences.resetLabel")}>
        <CommandReset commandId="reset-preferences-settings" />
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsPreferences };
