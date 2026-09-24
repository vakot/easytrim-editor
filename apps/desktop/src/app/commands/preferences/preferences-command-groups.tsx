import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useAudioPreferenceCommands } from "./definitions/audio.commands";
import { useLanguageCommands } from "./definitions/language.commands";
import { usePlaybackPreferenceCommands } from "./definitions/playback.commands";
import { useResetPreferencesCommand } from "./definitions/reset-preferences.command";

function usePreferencesCommandGroups() {
  const { t } = useTranslation();
  const playback = usePlaybackPreferenceCommands();
  const audio = useAudioPreferenceCommands();
  const reset = useResetPreferencesCommand();
  const languages = useLanguageCommands();
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
      reset,
    ]),
    defineApplicationCommandGroup("language", t("app.labels.commandSections.language"), languages),
  ] as const;
}

export { usePreferencesCommandGroups };
