import {
  BetweenVerticalStart,
  Languages,
  Magnet,
  Merge,
  Play,
  Repeat,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { PreferenceKey } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  preferencesReset,
  selectPreferences,
} from "@/app/store/slices/preferences-slice";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

const DEFAULT_PREFERENCE_KEYS = new Set<PreferenceKey>([
  "snapPlaybackEnabledDefault",
  "loopPlaybackEnabledDefault",
  "segmentPlaybackEnabledDefault",
  "mergeAudioEnabledDefault",
]);

interface PreferenceMenuItemProps {
  children: ReactNode;
  icon: ReactNode;
  preferenceKey: PreferenceKey;
}

function PreferenceMenuItem({ children, icon, preferenceKey }: PreferenceMenuItemProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const isEnabled = preferences[preferenceKey];
  const isDefaultPreference = DEFAULT_PREFERENCE_KEYS.has(preferenceKey);
  const tooltip = isDefaultPreference
    ? isEnabled
      ? t("settings.tooltips.enabledByDefault")
      : t("settings.tooltips.disabledByDefault")
    : isEnabled
      ? t("common.status.enabled")
      : t("common.status.disabled");

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <MenubarCheckboxItem
          checked={isEnabled}
          keepOpen
          onSelect={() => {
            dispatch(preferenceChanged({ key: preferenceKey, enabled: !isEnabled }));
          }}
        >
          <MenubarIcon side="right">{icon}</MenubarIcon>
          {children}
        </MenubarCheckboxItem>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function MenuBarSettings() {
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
  const languageLabels: Record<SupportedLanguage, string> = {
    en: t("settings.options.languages.english"),
    sk: t("settings.options.languages.slovak"),
  };

  const resetPreferences = () => {
    dispatch(preferencesReset());
  };

  return (
    <MenubarMenu value="settings">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="xs" type="button" variant="ghost">
          {t("settings.labels.title")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <PreferenceMenuItem
            icon={<Play aria-hidden="true" className="size-3" />}
            preferenceKey="autoStartQueueEnabled"
          >
            {t("settings.labels.autoStartQueue")}
          </PreferenceMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <PreferenceMenuItem
            icon={<Magnet aria-hidden="true" className="size-3" />}
            preferenceKey="snapPlaybackEnabledDefault"
          >
            {t("settings.labels.snap")}
          </PreferenceMenuItem>
          <PreferenceMenuItem
            icon={<Repeat aria-hidden="true" className="size-3" />}
            preferenceKey="loopPlaybackEnabledDefault"
          >
            {t("settings.labels.loop")}
          </PreferenceMenuItem>
          <PreferenceMenuItem
            icon={<BetweenVerticalStart aria-hidden="true" className="size-3" />}
            preferenceKey="segmentPlaybackEnabledDefault"
          >
            {t("settings.labels.followSegment")}
          </PreferenceMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <PreferenceMenuItem
            icon={<Merge aria-hidden="true" className="size-3" />}
            preferenceKey="mergeAudioEnabledDefault"
          >
            {t("settings.labels.mergeAudio")}
          </PreferenceMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem inset keepOpen onSelect={() => resetPreferences()} variant="destructive">
            <MenubarIcon>
              <RotateCcw aria-hidden="true" />
            </MenubarIcon>
            {t("settings.actions.reset")}
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarSub>
            <MenubarSubTrigger inset>
              <MenubarIcon>
                <Languages aria-hidden="true" />
              </MenubarIcon>
              {t("settings.labels.language")}
              <MenubarShortcut>{currentLanguage.toUpperCase()}</MenubarShortcut>
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                onValueChange={(language) =>
                  void i18n.changeLanguage(language as SupportedLanguage)
                }
                value={currentLanguage}
              >
                {(["en", "sk"] as const).map((language) => (
                  <MenubarRadioItem inset key={language} value={language}>
                    {languageLabels[language]}
                    <MenubarShortcut>{language.toUpperCase()}</MenubarShortcut>
                  </MenubarRadioItem>
                ))}
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
