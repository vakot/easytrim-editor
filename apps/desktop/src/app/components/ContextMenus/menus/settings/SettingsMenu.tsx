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
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";

import type { PreferenceKey } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  preferenceChanged,
  preferencesReset,
  selectPreferences,
} from "@/app/store/slices/preferences-slice";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

import type { MenuNavigation } from "../../types";

const DEFAULT_PREFERENCE_KEYS = new Set<PreferenceKey>([
  "snapPlaybackEnabledDefault",
  "loopPlaybackEnabledDefault",
  "segmentPlaybackEnabledDefault",
  "mergeAudioEnabledDefault",
]);

interface PreferenceMenuItemProps {
  preferenceKey: PreferenceKey;
  icon: ReactNode;
  children: ReactNode;
}

function PreferenceMenuItem({ preferenceKey, icon, children }: PreferenceMenuItemProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const isEnabled = preferences[preferenceKey];
  const isDefaultPreference = DEFAULT_PREFERENCE_KEYS.has(preferenceKey);

  return (
    <MenuItem
      icon={icon}
      tooltip={t(
        isDefaultPreference
          ? isEnabled
            ? "app.settings.enabledByDefault"
            : "app.settings.disabledByDefault"
          : isEnabled
            ? "app.settings.enabled"
            : "app.settings.disabled",
      )}
      tooltipProps={{ side: "right", preserveOnTrigger: true }}
      suffix={<Switch size="sm" checked={isEnabled} />}
      onSelect={(event) => {
        event.preventDefault();
        dispatch(preferenceChanged({ key: preferenceKey, enabled: !isEnabled }));
      }}
    >
      {children}
    </MenuItem>
  );
}

export function SettingsMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const resetPreferences = () => {
    dispatch(preferencesReset());
  };

  return (
    <Menu modal={false} open={navigation.open} onOpenChange={navigation.onOpenChange}>
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          {t("app.topBarMenus.settings")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <PreferenceMenuItem
          preferenceKey="autoStartQueueEnabled"
          icon={<Play className="size-3" aria-hidden="true" />}
        >
          {t("app.settings.autoStartQueue")}
        </PreferenceMenuItem>
        <MenuSeparator />
        <PreferenceMenuItem
          preferenceKey="snapPlaybackEnabledDefault"
          icon={<Magnet className="size-3" aria-hidden="true" />}
        >
          {t("app.settings.snap")}
        </PreferenceMenuItem>
        <PreferenceMenuItem
          preferenceKey="loopPlaybackEnabledDefault"
          icon={<Repeat className="size-3" aria-hidden="true" />}
        >
          {t("app.settings.loop")}
        </PreferenceMenuItem>
        <PreferenceMenuItem
          preferenceKey="segmentPlaybackEnabledDefault"
          icon={<BetweenVerticalStart className="size-3" aria-hidden="true" />}
        >
          {t("app.settings.followSegment")}
        </PreferenceMenuItem>
        <MenuSeparator />
        <PreferenceMenuItem
          preferenceKey="mergeAudioEnabledDefault"
          icon={<Merge className="size-3" aria-hidden="true" />}
        >
          {t("app.settings.mergeAudio")}
        </PreferenceMenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<RotateCcw className="size-3" aria-hidden="true" />}
          onSelect={(event) => {
            event.preventDefault();
            resetPreferences();
          }}
        >
          {t("app.settings.resetToDefault")}
        </MenuItem>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger
            icon={<Languages className="size-3" aria-hidden="true" />}
            suffix={currentLanguage.toUpperCase()}
          >
            {t("app.topBarMenus.language")}
          </MenuSubTrigger>
          <MenuSubContent>
            {(["en", "sk"] as const).map((language) => (
              <MenuItem
                key={language}
                selected={language === currentLanguage}
                suffix={language.toUpperCase()}
                onSelect={() => void i18n.changeLanguage(language as SupportedLanguage)}
              >
                {t(language === "en" ? "language.english" : "language.slovak")}
              </MenuItem>
            ))}
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
