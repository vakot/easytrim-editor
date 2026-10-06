import { useTranslation } from "react-i18next";

import { CommandReset, CommandSwitch, SettingRow, SettingsSection } from "../components/SettingRow";

function SettingsEditor() {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("settings.labels.editor")}>
      <SettingRow
        description={t("settings.pages.defaults.loopDescription")}
        label={t("settings.labels.loop")}
      >
        <CommandSwitch
          aria-label={t("settings.labels.loop")}
          commandId="preference-loop-playback"
        />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.defaults.followSegmentDescription")}
        label={t("settings.labels.followSegment")}
      >
        <CommandSwitch
          aria-label={t("settings.labels.followSegment")}
          commandId="preference-segment-playback"
        />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.defaults.mergeAudioDescription")}
        label={t("settings.labels.mergeAudio")}
      >
        <CommandSwitch
          aria-label={t("settings.labels.mergeAudio")}
          commandId="preference-merge-audio"
        />
      </SettingRow>

      <SettingRow label={t("settings.pages.defaults.resetLabel")}>
        <CommandReset commandId="reset-editor-settings" />
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsEditor };
