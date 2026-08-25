import {
  BetweenVerticalStart,
  Languages,
  Magnet,
  Merge,
  Play,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  preferenceChanged,
  preferencesReset,
  selectPreferences,
} from "@/app/store/slices/preferences-slice";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { audioMergeChanged } from "@/app/store/slices/audio-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { DEFAULT_PREFERENCES, type PreferenceKey } from "@/app/preferences";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

import type { MenuNavigation } from "../../types";

export function SettingsMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const preferences = useAppSelector(selectPreferences);
  const switchInteractionRef = useRef(false);
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const updatePreference = (key: PreferenceKey, enabled: boolean) => {
    dispatch(preferenceChanged({ key, enabled }));
    if (key === "mergeAudioEnabledDefault" && sourceSelection) {
      dispatch(audioMergeChanged({ sourceId: sourceSelection.sourceId, enabled }));
    }
  };

  const resetPreferences = () => {
    dispatch(preferencesReset());
    if (sourceSelection) {
      dispatch(
        audioMergeChanged({
          sourceId: sourceSelection.sourceId,
          enabled: DEFAULT_PREFERENCES.mergeAudioEnabledDefault,
        }),
      );
    }
  };

  const settingsPreferenceOption = (
    id: string,
    children: ReactNode,
    icon: ReactNode,
    key: PreferenceKey,
  ): ContextMenuOption => ({
    id,
    children,
    icon,
    suffix: (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Switch
              size="sm"
              checked={preferences[key]}
              onCheckedChange={(enabled) => updatePreference(key, enabled)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={() => {
                switchInteractionRef.current = true;
              }}
              onPointerDown={(event) => {
                switchInteractionRef.current = true;
                event.stopPropagation();
              }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t(
            key === "autoStartQueueEnabled"
              ? preferences[key]
                ? "app.settings.enabled"
                : "app.settings.disabled"
              : preferences[key]
                ? "app.settings.enabledByDefault"
                : "app.settings.disabledByDefault",
          )}
        </TooltipContent>
      </Tooltip>
    ),
    shouldCloseOnClick: false,
    onSelect: () => {
      if (switchInteractionRef.current) {
        switchInteractionRef.current = false;
        return;
      }
      updatePreference(key, !preferences[key]);
    },
  });

  const languageOptions: ContextMenuOption[] = (["en", "sk"] as const).map((language) => ({
    id: `language-${language}`,
    children: t(language === "en" ? "language.english" : "language.slovak"),
    suffix: language.toUpperCase(),
    selected: language === currentLanguage,
    onSelect: () => void i18n.changeLanguage(language as SupportedLanguage),
  }));

  return (
    <ContextMenu
      {...navigation}
      options={[
        settingsPreferenceOption(
          "setting-auto-start-queue",
          t("app.settings.autoStartQueue"),
          <Play className="size-3" aria-hidden="true" />,
          "autoStartQueueEnabled",
        ),
        { id: "settings-playback-divider", separator: true },
        settingsPreferenceOption(
          "setting-snap-playback",
          t("app.settings.snap"),
          <Magnet className="size-3" aria-hidden="true" />,
          "snapPlaybackEnabledDefault",
        ),
        settingsPreferenceOption(
          "setting-loop",
          t("app.settings.loop"),
          <Repeat className="size-3" aria-hidden="true" />,
          "loopPlaybackEnabledDefault",
        ),
        settingsPreferenceOption(
          "setting-segment",
          t("app.settings.followSegment"),
          <BetweenVerticalStart className="size-3" aria-hidden="true" />,
          "segmentPlaybackEnabledDefault",
        ),
        { id: "settings-audio-divider", separator: true },
        settingsPreferenceOption(
          "setting-merge-audio",
          t("app.settings.mergeAudio"),
          <Merge className="size-3" aria-hidden="true" />,
          "mergeAudioEnabledDefault",
        ),
        { id: "settings-reset-divider", separator: true },
        {
          id: "settings-reset",
          children: t("app.settings.resetToDefault"),
          icon: <RotateCcw className="size-3" aria-hidden="true" />,
          shouldCloseOnClick: false,
          onSelect: resetPreferences,
        },
        { id: "settings-language-divider", separator: true },
        {
          id: "language",
          children: t("app.topBarMenus.language"),
          icon: <Languages className="size-3" aria-hidden="true" />,
          suffix: currentLanguage.toUpperCase(),
          shouldCloseOnClick: false,
          options: languageOptions,
        },
      ]}
    >
      {t("app.topBarMenus.settings")}
    </ContextMenu>
  );
}
