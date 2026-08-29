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
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  preferencesReset,
  selectPreferences,
} from "@/app/store/slices/preferences-slice";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

import type { MenuNavigation } from "../types";

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

  return (
    <MenuItem
      icon={icon}
      onSelect={(event) => {
        event.preventDefault();
        dispatch(preferenceChanged({ key: preferenceKey, enabled: !isEnabled }));
      }}
      suffix={<Switch checked={isEnabled} size="sm" />}
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
    >
      {children}
    </MenuItem>
  );
}

export function ContextMenuSettings({ navigation }: { navigation: MenuNavigation }) {
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const resetPreferences = () => {
    dispatch(preferencesReset());
  };

  return (
    <Menu modal={false} onOpenChange={navigation.onOpenChange} open={navigation.open}>
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("app.topBarMenus.settings")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <PreferenceMenuItem
          icon={<Play aria-hidden="true" className="size-3" />}
          preferenceKey="autoStartQueueEnabled"
        >
          {t("app.settings.autoStartQueue")}
        </PreferenceMenuItem>
        <MenuSeparator />
        <PreferenceMenuItem
          icon={<Magnet aria-hidden="true" className="size-3" />}
          preferenceKey="snapPlaybackEnabledDefault"
        >
          {t("app.settings.snap")}
        </PreferenceMenuItem>
        <PreferenceMenuItem
          icon={<Repeat aria-hidden="true" className="size-3" />}
          preferenceKey="loopPlaybackEnabledDefault"
        >
          {t("app.settings.loop")}
        </PreferenceMenuItem>
        <PreferenceMenuItem
          icon={<BetweenVerticalStart aria-hidden="true" className="size-3" />}
          preferenceKey="segmentPlaybackEnabledDefault"
        >
          {t("app.settings.followSegment")}
        </PreferenceMenuItem>
        <MenuSeparator />
        <PreferenceMenuItem
          icon={<Merge aria-hidden="true" className="size-3" />}
          preferenceKey="mergeAudioEnabledDefault"
        >
          {t("app.settings.mergeAudio")}
        </PreferenceMenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<RotateCcw aria-hidden="true" className="size-3" />}
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
            icon={<Languages aria-hidden="true" className="size-3" />}
            suffix={currentLanguage.toUpperCase()}
          >
            {t("app.topBarMenus.language")}
          </MenuSubTrigger>
          <MenuSubContent>
            {(["en", "sk"] as const).map((language) => (
              <MenuItem
                key={language}
                onSelect={() => void i18n.changeLanguage(language as SupportedLanguage)}
                selected={language === currentLanguage}
                suffix={language.toUpperCase()}
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
