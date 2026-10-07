import type { TFunction } from "i18next";
import { Keyboard } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

import { SETTINGS_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import {
  Library,
  LibraryContent,
  LibraryDialog,
  LibraryDialogContent,
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

function SettingsDialog() {
  const { t } = useTranslation();
  const { closeSettings, isSettingsOpen } = useSettingsDialog();
  const [selectedPage, setSelectedPage] = useState<SettingsPageId>("general");

  return (
    <LibraryDialog onOpenChange={(open) => !open && closeSettings()} open={isSettingsOpen}>
      <LibraryDialogContent>
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
          <LibraryNavigation aria-label={t("settings.pages.navigationLabel")}>
            <LibraryNavigationGroup>
              <SettingsPageItem page="general" />
              <SettingsPageItem page="appearance" />
              <SettingsPageItem page="preferences" />
              <SettingsPageItem page="layout" />
              <SettingsPageItem page="about" />
            </LibraryNavigationGroup>
          </LibraryNavigation>

          <Separator orientation="vertical" />

          <LibraryContent>
            <SettingsPage page="general">
              <Badge
                className="h-8 gap-2 border-primary/10 bg-primary/5 text-muted-foreground"
                variant="outline"
              >
                <Keyboard aria-hidden="true" className="size-4" />
                {t("settings.pages.general.openSettingsShortcutLabel")}
                <KbdGroup>
                  {getShortcutDisplayKeys(SETTINGS_SHORTCUT).map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </KbdGroup>
              </Badge>
              <SettingsGeneral />
            </SettingsPage>
            <SettingsPage page="appearance">
              <SettingsAppearance />
            </SettingsPage>
            <SettingsPage page="preferences">
              <SettingsPreferences />
            </SettingsPage>
            <SettingsPage page="layout">
              <SettingsLayout />
            </SettingsPage>
            <SettingsPage page="about">
              <SettingsAbout />
            </SettingsPage>
          </LibraryContent>
        </Library>
      </LibraryDialogContent>
    </LibraryDialog>
  );
}

function SettingsPageItem({ page }: { page: SettingsPageId }) {
  const { t } = useTranslation();

  return (
    <LibraryNavigationItem value={page}>{getSettingsPageTitle(t, page)}</LibraryNavigationItem>
  );
}

function SettingsPage({ children, page }: { children: ReactNode; page: SettingsPageId }) {
  return (
    <LibraryPage className="space-y-4" value={page}>
      {children}
    </LibraryPage>
  );
}

function getSettingsPageTitle(t: TFunction, page: SettingsPageId) {
  switch (page) {
    case "general":
      return t("settings.pages.general.title");
    case "appearance":
      return t("settings.pages.appearance.title");
    case "preferences":
      return t("settings.pages.preferences.title");
    case "layout":
      return t("settings.pages.layout.title");
    case "about":
      return t("settings.pages.about.title");
  }
}

function getSettingsPageDescription(t: TFunction, page: SettingsPageId) {
  switch (page) {
    case "general":
      return t("settings.pages.general.description");
    case "appearance":
      return t("settings.pages.appearance.description");
    case "preferences":
      return t("settings.pages.preferences.description");
    case "layout":
      return t("settings.pages.layout.description");
    case "about":
      return t("settings.pages.about.description");
  }
}

export { SettingsDialog };
