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
import { type PreferenceKey } from "@/app/preferences";
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
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

import type { MenuNavigation } from "../../types";

export function SettingsMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const switchInteractionRef = useRef(false);
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const updatePreference = (key: PreferenceKey, enabled: boolean) => {
    dispatch(preferenceChanged({ key, enabled }));
  };

  const resetPreferences = () => {
    dispatch(preferencesReset());
  };

  const settingsPreferenceItem = (children: ReactNode, icon: ReactNode, key: PreferenceKey) => (
    <MenuItem
      icon={icon}
      tooltip={t(
        key === "autoStartQueueEnabled"
          ? preferences[key]
            ? "app.settings.enabled"
            : "app.settings.disabled"
          : preferences[key]
            ? "app.settings.enabledByDefault"
            : "app.settings.disabledByDefault",
      )}
      tooltipProps={{ side: "right" }}
      suffix={
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
      }
      onSelect={(event) => {
        event.preventDefault();
        if (switchInteractionRef.current) {
          switchInteractionRef.current = false;
          return;
        }
        updatePreference(key, !preferences[key]);
      }}
    >
      {children}
    </MenuItem>
  );

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
        {settingsPreferenceItem(
          t("app.settings.autoStartQueue"),
          <Play className="size-3" aria-hidden="true" />,
          "autoStartQueueEnabled",
        )}
        <MenuSeparator />
        {settingsPreferenceItem(
          t("app.settings.snap"),
          <Magnet className="size-3" aria-hidden="true" />,
          "snapPlaybackEnabledDefault",
        )}
        {settingsPreferenceItem(
          t("app.settings.loop"),
          <Repeat className="size-3" aria-hidden="true" />,
          "loopPlaybackEnabledDefault",
        )}
        {settingsPreferenceItem(
          t("app.settings.followSegment"),
          <BetweenVerticalStart className="size-3" aria-hidden="true" />,
          "segmentPlaybackEnabledDefault",
        )}
        <MenuSeparator />
        {settingsPreferenceItem(
          t("app.settings.mergeAudio"),
          <Merge className="size-3" aria-hidden="true" />,
          "mergeAudioEnabledDefault",
        )}
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
