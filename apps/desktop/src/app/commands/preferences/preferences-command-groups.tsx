import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useAudioPreferenceCommands } from "./definitions/audio.commands";
import { useOpenSettingsCommand } from "./definitions/open-settings.command";
import { usePlaybackPreferenceCommands } from "./definitions/playback.commands";
import { useResetPreferencesCommand } from "./definitions/reset-preferences.command";

function usePreferencesCommandGroups() {
  const { t } = useTranslation();
  const playback = usePlaybackPreferenceCommands();
  const audio = useAudioPreferenceCommands();
  const reset = useResetPreferencesCommand();
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
      reset,
    ]),
  ] as const;
}

export { usePreferencesCommandGroups };
