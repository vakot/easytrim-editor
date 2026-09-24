import {
  BetweenVerticalStart,
  FileOutputIcon,
  Magnet,
  Merge,
  Play,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  preferencesReset,
  selectAutoStartQueueEnabled,
  selectLoopPlaybackEnabledDefault,
  selectMergeAudioEnabledDefault,
  selectSegmentPlaybackEnabledDefault,
  selectSnapPlaybackEnabledDefault,
} from "@/app/store/slices/preferences-slice";

function getLanguageCommandId(language: "en" | "sk" | "ru") {
  return `language-${language}` as const;
}

function usePreferencesCommandGroup() {
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const autoStartQueueEnabled = useAppSelector(selectAutoStartQueueEnabled);
  const loopPlaybackEnabledDefault = useAppSelector(selectLoopPlaybackEnabledDefault);
  const mergeAudioEnabledDefault = useAppSelector(selectMergeAudioEnabledDefault);
  const segmentPlaybackEnabledDefault = useAppSelector(selectSegmentPlaybackEnabledDefault);
  const snapPlaybackEnabledDefault = useAppSelector(selectSnapPlaybackEnabledDefault);
  const preferenceLabels = useMemo(
    () => ({
      autoStartQueueEnabled: t("settings.labels.autoStartQueue"),
      loopPlaybackEnabledDefault: t("settings.options.commandLabels.loop"),
      mergeAudioEnabledDefault: t("settings.options.commandLabels.mergeAudio"),
      segmentPlaybackEnabledDefault: t("settings.options.commandLabels.followSegment"),
      snapPlaybackEnabledDefault: t("settings.options.commandLabels.snap"),
    }),
    [t],
  );

  const languageLabels = useMemo(
    () => ({
      en: t("settings.options.languages.english"),
      ru: t("settings.options.languages.russian"),
      sk: t("settings.options.languages.slovak"),
    }),
    [t],
  );

  const playbackSection = useMemo(
    () => ({
      id: "preferences-playback",
      label: t("app.labels.commandSections.preferencesPlayback"),
    }),
    [t],
  );

  const audioSection = useMemo(
    () => ({ id: "preferences-audio", label: t("app.labels.commandSections.preferencesAudio") }),
    [t],
  );

  const preferenceSection = useMemo(
    () => ({ id: "preferences", label: t("app.labels.commandSections.preferences") }),
    [t],
  );

  const languageSection = useMemo(
    () => ({ id: "language", label: t("app.labels.commandSections.language") }),
    [t],
  );

  return useMemo(
    () =>
      defineApplicationCommandGroup("preferences", [
        ...(
          [
            [
              "auto-start-queue",
              "autoStartQueueEnabled",
              autoStartQueueEnabled,
              <Play aria-hidden="true" />,
            ],
            [
              "snap-playback",
              "snapPlaybackEnabledDefault",
              snapPlaybackEnabledDefault,
              <Magnet aria-hidden="true" />,
            ],
            [
              "loop-playback",
              "loopPlaybackEnabledDefault",
              loopPlaybackEnabledDefault,
              <Repeat aria-hidden="true" />,
            ],
            [
              "segment-playback",
              "segmentPlaybackEnabledDefault",
              segmentPlaybackEnabledDefault,
              <BetweenVerticalStart aria-hidden="true" />,
            ],
            [
              "merge-audio",
              "mergeAudioEnabledDefault",
              mergeAudioEnabledDefault,
              <Merge aria-hidden="true" />,
            ],
          ] as const
        ).map(([id, key, checked, icon]) => ({
          checked,
          enabled: true,
          icon,
          run() {
            dispatch(preferenceChanged({ key, enabled: !checked }));
          },
          id: `preference-${id}` as const,
          label: preferenceLabels[key],
          searchTerms: commandSearchTerms(`${preferenceLabels[key]}|preference|setting`),
          section: key === "mergeAudioEnabledDefault" ? audioSection : playbackSection,
          variant: "default" as const,
        })),
        {
          enabled: true,
          icon: <RotateCcw aria-hidden="true" />,
          run() {
            dispatch(preferencesReset());
          },
          id: "reset-preferences",
          label: t("settings.actions.reset"),
          searchTerms: commandSearchTerms(`${t("settings.actions.reset")}|settings|preferences`),
          section: preferenceSection,
          variant: "destructive",
        },
        ...(["en", "sk", "ru"] as const).map((language) => ({
          checked: i18n.resolvedLanguage === language,
          enabled: true,
          icon: <FileOutputIcon aria-hidden="true" />,
          async run() {
            await i18n.changeLanguage(language);
          },
          id: getLanguageCommandId(language),
          label: languageLabels[language],
          searchTerms: commandSearchTerms(`${languageLabels[language]}|language`),
          section: languageSection,
          variant: "default" as const,
        })),
      ]),
    [
      audioSection,
      autoStartQueueEnabled,
      dispatch,
      i18n,
      languageLabels,
      languageSection,
      loopPlaybackEnabledDefault,
      mergeAudioEnabledDefault,
      playbackSection,
      preferenceLabels,
      preferenceSection,
      segmentPlaybackEnabledDefault,
      snapPlaybackEnabledDefault,
      t,
    ],
  );
}

export { getLanguageCommandId, usePreferencesCommandGroup };
