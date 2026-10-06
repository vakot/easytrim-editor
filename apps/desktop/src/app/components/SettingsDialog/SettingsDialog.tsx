import type { TFunction } from "i18next";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";

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
import { SettingsEditor } from "./pages/SettingsEditor";
import { SettingsGeneral } from "./pages/SettingsGeneral";
import { SettingsLayout } from "./pages/SettingsLayout";
import { SettingsQueue } from "./pages/SettingsQueue";

type SettingsPageId = "general" | "appearance" | "editor" | "layout" | "queue" | "about";

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
              <SettingsPageItem page="editor" />
              <SettingsPageItem page="layout" />
              <SettingsPageItem page="queue" />
              <SettingsPageItem page="about" />
            </LibraryNavigationGroup>
          </LibraryNavigation>

          <Separator orientation="vertical" />

          <LibraryContent>
            <SettingsPage page="general">
              <SettingsGeneral />
            </SettingsPage>
            <SettingsPage page="appearance">
              <SettingsAppearance />
            </SettingsPage>
            <SettingsPage page="editor">
              <SettingsEditor />
            </SettingsPage>
            <SettingsPage page="layout">
              <SettingsLayout />
            </SettingsPage>
            <SettingsPage page="queue">
              <SettingsQueue />
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
    case "editor":
      return t("settings.pages.defaults.title");
    case "layout":
      return t("settings.pages.layout.title");
    case "queue":
      return t("settings.pages.queue.title");
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
    case "editor":
      return t("settings.pages.defaults.description");
    case "layout":
      return t("settings.pages.layout.description");
    case "queue":
      return t("settings.pages.queue.description");
    case "about":
      return t("settings.pages.about.description");
  }
}

export { SettingsDialog };
