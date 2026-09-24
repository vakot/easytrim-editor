import { Languages } from "lucide-react";
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

import type { ApplicationCommandId } from "@/app/commands";
import { getLanguageCommandId } from "@/app/commands/preferences";
import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import { useApplicationCommand } from "@/app/hooks/useApplicationCommands";
import { isSupportedLanguage } from "@/i18n/resources";

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
  const { i18n, t } = useTranslation();
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
  return (
    <MenubarMenu value="settings">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("settings.labels.title")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <PreferenceMenuItem commandId="preference-auto-start-queue">
            {t("settings.labels.autoStartQueue")}
          </PreferenceMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <PreferenceMenuItem commandId="preference-snap-playback">
            {t("settings.labels.snap")}
          </PreferenceMenuItem>
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
          <MenubarSub>
            <MenubarSubTrigger inset>
              <MenubarIcon>
                <Languages aria-hidden="true" />
              </MenubarIcon>
              {t("settings.labels.language")}
              <MenubarShortcut>{currentLanguage.toUpperCase()}</MenubarShortcut>
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup value={currentLanguage}>
                {(["en", "sk", "ru"] as const).map((language) => (
                  <ApplicationCommandMenuItem
                    asChild
                    commandId={getLanguageCommandId(language)}
                    key={language}
                  >
                    <MenubarRadioItem value={language}>
                      <ApplicationCommandLabel />
                      <MenubarShortcut>{language.toUpperCase()}</MenubarShortcut>
                    </MenubarRadioItem>
                  </ApplicationCommandMenuItem>
                ))}
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}

export { MenuBarSettings };
