import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useAudioPreferenceCommands } from "./definitions/audio.commands";
import { useOpenSettingsCommand } from "./definitions/open-settings.command";
import { usePlaybackPreferenceCommands } from "./definitions/playback.commands";
import { useResetPreferencesSettingsCommand } from "./definitions/reset-preferences-settings.command";

function usePreferencesCommandGroups() {
  const { t } = useTranslation();
  const playback = usePlaybackPreferenceCommands();
  const audio = useAudioPreferenceCommands();
  const resetPreferencesSettings = useResetPreferencesSettingsCommand();
  const openSettings = useOpenSettingsCommand();
  return [
    defineApplicationCommandGroup(
      "preferences-playback",
      t("app.labels.commandSections.preferencesPlayback"),
      playback,
    ),
    defineApplicationCommandGroup(
      "preferences-audio",
      t("app.labels.commandSections.preferencesAudio"),
      audio,
    ),
    defineApplicationCommandGroup("preferences", t("app.labels.commandSections.preferences"), [
      openSettings,
      resetPreferencesSettings,
    ]),
  ] as const;
}

export { usePreferencesCommandGroups };
