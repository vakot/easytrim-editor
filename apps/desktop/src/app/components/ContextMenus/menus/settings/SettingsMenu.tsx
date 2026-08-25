import { BetweenVerticalStart, Languages, Magnet, Merge, Repeat, RotateCcw } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  selectToolDefaults,
  toolDefaultChanged,
  toolDefaultsReset,
} from "@/app/store/slices/preferences-slice";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { audioMergeChanged, selectSourceSelection } from "@/app/store/slices/session-slice";
import { DEFAULT_TOOL_DEFAULTS, type ToolDefaultKey } from "@/app/tool-settings";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

import type { MenuNavigation } from "../../types";

export function SettingsMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const toolDefaults = useAppSelector(selectToolDefaults);
  const switchInteractionRef = useRef(false);
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const updateToolDefault = (key: ToolDefaultKey, enabled: boolean) => {
    dispatch(toolDefaultChanged({ key, enabled }));
    if (key === "mergeAudioEnabled" && sourceSelection) {
      // NOTE: Transitional bridge: merge-audio Settings has always applied to the active source.
      // The source value remains session-owned until the session migration phase.
      dispatch(audioMergeChanged({ sourceId: sourceSelection.sourceId, enabled }));
    }
  };

  const resetDefaults = () => {
    dispatch(toolDefaultsReset());
    if (sourceSelection) {
      // NOTE: Keep the same explicit merge-audio compatibility behavior on reset.
      dispatch(
        audioMergeChanged({
          sourceId: sourceSelection.sourceId,
          enabled: DEFAULT_TOOL_DEFAULTS.mergeAudioEnabled,
        }),
      );
    }
  };

  const settingsToolOption = (
    id: string,
    children: ReactNode,
    icon: ReactNode,
    key: ToolDefaultKey,
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
              checked={toolDefaults[key]}
              onCheckedChange={(enabled) => updateToolDefault(key, enabled)}
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
            toolDefaults[key] ? "app.settings.enabledByDefault" : "app.settings.disabledByDefault",
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
      updateToolDefault(key, !toolDefaults[key]);
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
        settingsToolOption(
          "setting-snap-playback",
          t("app.settings.snap"),
          <Magnet className="size-3" aria-hidden="true" />,
          "snapPlaybackEnabled",
        ),
        settingsToolOption(
          "setting-loop",
          t("app.settings.loop"),
          <Repeat className="size-3" aria-hidden="true" />,
          "loopPlaybackEnabled",
        ),
        settingsToolOption(
          "setting-segment",
          t("app.settings.followSegment"),
          <BetweenVerticalStart className="size-3" aria-hidden="true" />,
          "segmentPlaybackEnabled",
        ),
        { id: "settings-audio-divider", separator: true },
        settingsToolOption(
          "setting-merge-audio",
          t("app.settings.mergeAudio"),
          <Merge className="size-3" aria-hidden="true" />,
          "mergeAudioEnabled",
        ),
        { id: "settings-reset-divider", separator: true },
        {
          id: "settings-reset",
          children: t("app.settings.resetToDefault"),
          icon: <RotateCcw className="size-3" aria-hidden="true" />,
          shouldCloseOnClick: false,
          onSelect: resetDefaults,
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
