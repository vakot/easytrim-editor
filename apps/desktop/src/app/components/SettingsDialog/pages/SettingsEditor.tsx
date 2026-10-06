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
        <CommandSwitch commandId="preference-loop-playback" label={t("settings.labels.loop")} />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.defaults.followSegmentDescription")}
        label={t("settings.labels.followSegment")}
      >
        <CommandSwitch
          commandId="preference-segment-playback"
          label={t("settings.labels.followSegment")}
        />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.defaults.mergeAudioDescription")}
        label={t("settings.labels.mergeAudio")}
      >
        <CommandSwitch commandId="preference-merge-audio" label={t("settings.labels.mergeAudio")} />
      </SettingRow>

      <SettingRow label={t("settings.pages.defaults.resetLabel")}>
        <CommandReset commandId="reset-preferences" />
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsEditor };
