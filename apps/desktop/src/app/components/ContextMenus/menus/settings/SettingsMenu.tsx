import { BetweenVerticalStart, Languages, Magnet, Merge, Repeat, RotateCcw } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_TOOL_DEFAULTS,
  loadToolDefaults,
  persistToolDefaults,
  type ToolDefaultKey,
  type ToolDefaults,
} from "@/app/tool-settings";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

import type { MenuNavigation } from "../../types";

interface SettingsMenuProps {
  navigation: MenuNavigation;
  toolDefaults?: ToolDefaults;
  onToolDefaultChange?: (key: ToolDefaultKey, enabled: boolean) => void;
  onResetToolDefaults?: () => void;
}

export function SettingsMenu({
  navigation,
  toolDefaults: controlledToolDefaults,
  onToolDefaultChange: controlledToolDefaultChange,
  onResetToolDefaults: controlledResetToolDefaults,
}: SettingsMenuProps) {
  const { t, i18n } = useTranslation();
  const [fallbackToolDefaults, setFallbackToolDefaults] = useState<ToolDefaults>(loadToolDefaults);
  const switchInteractionRef = useRef(false);
  const toolDefaults = controlledToolDefaults ?? fallbackToolDefaults;
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const setToolDefault = (key: ToolDefaultKey, enabled: boolean) => {
    if (controlledToolDefaultChange) {
      controlledToolDefaultChange(key, enabled);
      return;
    }
    setFallbackToolDefaults((current) => {
      const next = { ...current, [key]: enabled };
      persistToolDefaults(next);
      return next;
    });
  };

  const resetToolDefaults = () => {
    if (controlledResetToolDefaults) {
      controlledResetToolDefaults();
      return;
    }
    setFallbackToolDefaults(DEFAULT_TOOL_DEFAULTS);
    persistToolDefaults(DEFAULT_TOOL_DEFAULTS);
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
              onCheckedChange={(enabled) => setToolDefault(key, enabled)}
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
      setToolDefault(key, !toolDefaults[key]);
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
          "setting-safe-trim",
          t("app.settings.snap"),
          <Magnet className="size-3" aria-hidden="true" />,
          "safeTrimFollowingEnabled",
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
          onSelect: resetToolDefaults,
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
