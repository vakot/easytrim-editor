import { Languages } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ApplicationCommandId } from "@/app/commands";
import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import { useApplicationCommand } from "@/app/hooks/useApplicationCommands";
import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { LANGUAGE_CATALOG } from "@/domain/languages";
import { isSupportedLanguage } from "@/i18n/resources";

const supportedLanguages = LANGUAGE_CATALOG.filter(({ code }) => isSupportedLanguage(code));

interface PreferenceMenuItemProps {
  children: ReactNode;
  commandId: ApplicationCommandId;
}

function PreferenceMenuItem({ children, commandId }: PreferenceMenuItemProps) {
  const { t } = useTranslation();
  const { checked: isEnabled } = useApplicationCommand(commandId);
  const isDefaultPreference = commandId !== "preference-auto-start-queue";
  const tooltip = isDefaultPreference
    ? isEnabled
      ? t("settings.tooltips.enabledByDefault")
      : t("settings.tooltips.disabledByDefault")
    : isEnabled
      ? t("common.status.enabled")
      : t("common.status.disabled");

  return (
    <Tooltip preserveOnTrigger>
      <ApplicationCommandMenuItem asChild commandId={commandId}>
        <TooltipTrigger asChild>
          <MenubarCheckboxItem inset keepOpen>
            <MenubarIcon side="right">
              <ApplicationCommandIcon className="size-3" />
            </MenubarIcon>
            <ApplicationCommandLabel>{children}</ApplicationCommandLabel>
          </MenubarCheckboxItem>
        </TooltipTrigger>
      </ApplicationCommandMenuItem>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function MenuBarSettings() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="settings">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("settings.labels.title")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenuBarSettingsContent />
      </MenubarContent>
    </MenubarMenu>
  );
}

function MenuBarSettingsContent() {
  const { i18n, t } = useTranslation();
  const [languageSubmenuOpen, setLanguageSubmenuOpen] = useState(false);

  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <>
      <MenubarGroup>
        <PreferenceMenuItem commandId="preference-auto-start-queue">
          {t("settings.labels.autoStartQueue")}
        </PreferenceMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <PreferenceMenuItem commandId="preference-loop-playback">
          {t("settings.labels.loop")}
        </PreferenceMenuItem>
        <PreferenceMenuItem commandId="preference-segment-playback">
          {t("settings.labels.followSegment")}
        </PreferenceMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <PreferenceMenuItem commandId="preference-merge-audio">
          {t("settings.labels.mergeAudio")}
        </PreferenceMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="reset-preferences">
          <MenubarItem inset keepOpen variant="destructive">
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <LanguageSelector
          languages={supportedLanguages}
          onValueChange={(language) => {
            if (!isSupportedLanguage(language)) return;

            void i18n.changeLanguage(language);
            setLanguageSubmenuOpen(false);
          }}
          value={currentLanguage}
        >
          <MenubarSub onOpenChange={setLanguageSubmenuOpen} open={languageSubmenuOpen}>
            <LanguageSelectorTrigger>
              <MenubarSubTrigger inset>
                <MenubarIcon>
                  <Languages aria-hidden="true" />
                </MenubarIcon>
                {t("settings.labels.language")}
                <MenubarShortcut>
                  <span className="uppercase">
                    <LanguageSelectorValue type="code" />
                  </span>
                </MenubarShortcut>
              </MenubarSubTrigger>
            </LanguageSelectorTrigger>
            <LanguageSelectorContent asChild>
              <MenubarSubContent className="p-0">
                <LanguageSelectorInput
                  aria-label={t("common.labels.searchLanguages")}
                  className="h-7"
                  placeholder={t("common.labels.searchLanguages")}
                />
                <LanguageSelectorList />
              </MenubarSubContent>
            </LanguageSelectorContent>
          </MenubarSub>
        </LanguageSelector>
      </MenubarGroup>
    </>
  );
}

export { MenuBarSettings, MenuBarSettingsContent };
