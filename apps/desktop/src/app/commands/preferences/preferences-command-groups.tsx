import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useAudioPreferenceCommands } from "./definitions/audio.commands";
import { useOpenSettingsCommand } from "./definitions/open-settings.command";
import { usePlaybackPreferenceCommands } from "./definitions/playback.commands";
import { useResetEditingSettingsCommand } from "./definitions/reset-editing-settings.command";
import { useStripMetadataCommand } from "./definitions/strip-metadata.command";

function usePreferencesCommandGroups() {
  const { t } = useTranslation();
  const playback = usePlaybackPreferenceCommands();
  const audio = useAudioPreferenceCommands();
  const resetEditingSettings = useResetEditingSettingsCommand();
  const stripMetadata = useStripMetadataCommand();
  const openSettings = useOpenSettingsCommand();
  return [
    defineApplicationCommandGroup(
      "preferences-playback",
      t("commands.sections.preferencesPlayback"),
      playback,
    ),
    defineApplicationCommandGroup(
      "preferences-audio",
      t("commands.sections.preferencesAudio"),
      audio,
    ),
    defineApplicationCommandGroup("preferences-export", t("commands.sections.preferencesExport"), [
      stripMetadata,
    ]),
    defineApplicationCommandGroup("preferences", t("commands.sections.preferences"), [
      openSettings,
      resetEditingSettings,
    ]),
  ] as const;
}

export { usePreferencesCommandGroups };
