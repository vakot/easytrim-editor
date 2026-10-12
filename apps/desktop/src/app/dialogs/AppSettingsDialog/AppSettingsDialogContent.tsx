import type { TFunction } from "i18next";
import { Keyboard } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

import { SETTINGS_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import {
  Library,
  LibraryContent,
  LibraryDialogDescription,
  LibraryDialogHeader,
  LibraryDialogTitle,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryPage,
} from "@/components/library";

import { SettingsAbout } from "./pages/SettingsAbout";
import { SettingsAppearance } from "./pages/SettingsAppearance";
import { SettingsGeneral } from "./pages/SettingsGeneral";
import { SettingsLayout } from "./pages/SettingsLayout";
import { SettingsPreferences } from "./pages/SettingsPreferences";

type SettingsPageId = "general" | "appearance" | "preferences" | "layout" | "about";

function AppSettingsDialogContent() {
  const { t } = useTranslation();
  const [selectedPage, setSelectedPage] = useState<SettingsPageId>("general");

  return (
    <>
      <LibraryDialogHeader>
        <LibraryDialogTitle>{getSettingsPageTitle(t, selectedPage)}</LibraryDialogTitle>
        <LibraryDialogDescription>
          {getSettingsPageDescription(t, selectedPage)}
        </LibraryDialogDescription>
      </LibraryDialogHeader>

      <Library
        onValueChange={(value) => setSelectedPage(value as SettingsPageId)}
        value={selectedPage}
      >
        <LibraryNavigation aria-label={t("settings.navigationLabel")}>
          <LibraryNavigationGroup>
            <AppSettingsPageItem page="general" />
            <AppSettingsPageItem page="appearance" />
            <AppSettingsPageItem page="preferences" />
            <AppSettingsPageItem page="layout" />
            <AppSettingsPageItem page="about" />
          </LibraryNavigationGroup>
        </LibraryNavigation>

        <Separator orientation="vertical" />

        <LibraryContent>
          <AppSettingsPage page="general">
            <Badge
              className="h-8 gap-2 border-primary/10 bg-primary/5 text-muted-foreground"
              variant="outline"
            >
              <Keyboard aria-hidden="true" className="size-4" />
              {t("settings.general.shortcutHint")}
              <KbdGroup>
                {getShortcutDisplayKeys(SETTINGS_SHORTCUT).map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </Badge>
            <SettingsGeneral />
          </AppSettingsPage>
          <AppSettingsPage page="appearance">
            <SettingsAppearance />
          </AppSettingsPage>
          <AppSettingsPage page="preferences">
            <SettingsPreferences />
          </AppSettingsPage>
          <AppSettingsPage page="layout">
            <SettingsLayout />
          </AppSettingsPage>
          <AppSettingsPage page="about">
            <SettingsAbout />
          </AppSettingsPage>
        </LibraryContent>
      </Library>
    </>
  );
}

function AppSettingsPageItem({ page }: { page: SettingsPageId }) {
  const { t } = useTranslation();

  return (
    <LibraryNavigationItem value={page}>{getSettingsPageTitle(t, page)}</LibraryNavigationItem>
  );
}

function AppSettingsPage({ children, page }: { children: ReactNode; page: SettingsPageId }) {
  return (
    <LibraryPage className="space-y-4" value={page}>
      {children}
    </LibraryPage>
  );
}

function getSettingsPageTitle(t: TFunction, page: SettingsPageId) {
  switch (page) {
    case "general":
      return t("settings.general.title");
    case "appearance":
      return t("settings.appearance.title");
    case "preferences":
      return t("settings.preferences.title");
    case "layout":
      return t("settings.layout.title");
    case "about":
      return t("settings.about.title");
  }
}

function getSettingsPageDescription(t: TFunction, page: SettingsPageId) {
  switch (page) {
    case "general":
      return t("settings.general.description");
    case "appearance":
      return t("settings.appearance.description");
    case "preferences":
      return t("settings.preferences.description");
    case "layout":
      return t("settings.layout.description");
    case "about":
      return t("settings.about.description");
  }
}

export { AppSettingsDialogContent };
