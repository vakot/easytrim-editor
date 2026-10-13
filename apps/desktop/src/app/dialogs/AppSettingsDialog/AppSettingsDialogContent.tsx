import type { TFunction } from "i18next";
import { Keyboard } from "lucide-react";
import React, { type ReactNode, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { DialogScope } from "@/components/ui/dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

import { SETTINGS_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import {
  Library,
  LibraryContent,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryPage,
} from "@/components/library";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

type SettingsPageId = "general" | "appearance" | "preferences" | "layout" | "about";
const DEFAULT_PAGE: SettingsPageId = "general";

const LazySettingsAbout = lazyWithPreload<React.FragmentProps>(() =>
  import("./pages/SettingsAbout").then((module) => ({ default: module.SettingsAbout })),
);

const LazySettingsAppearance = lazyWithPreload<React.FragmentProps>(() =>
  import("./pages/SettingsAppearance").then((module) => ({ default: module.SettingsAppearance })),
);

const LazySettingsGeneral = lazyWithPreload<React.FragmentProps>(() =>
  import("./pages/SettingsGeneral").then((module) => ({ default: module.SettingsGeneral })),
);

const LazySettingsLayout = lazyWithPreload<React.FragmentProps>(() =>
  import("./pages/SettingsLayout").then((module) => ({ default: module.SettingsLayout })),
);

const LazySettingsPreferences = lazyWithPreload<React.FragmentProps>(() =>
  import("./pages/SettingsPreferences").then((module) => ({
    default: module.SettingsPreferences,
  })),
);

const preloadSettingsPage = {
  about: () => LazySettingsAbout.preload(),
  appearance: () => LazySettingsAppearance.preload(),
  general: () => LazySettingsGeneral.preload(),
  layout: () => LazySettingsLayout.preload(),
  preferences: () => LazySettingsPreferences.preload(),
} satisfies Record<SettingsPageId, () => Promise<unknown>>;

const AppSettingsDialogContent = Object.assign(
  function AppSettingsDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
    const { t } = useTranslation();
    const [selectedPage, setSelectedPage] = useState<SettingsPageId>(DEFAULT_PAGE);

    return (
      <>
        <DialogHeader className="m-0! border-b p-4">
          <DialogTitle __scopeDialog={__scopeDialog}>
            {getSettingsPageTitle(t, selectedPage)}
          </DialogTitle>
          <DialogDescription __scopeDialog={__scopeDialog}>
            {getSettingsPageDescription(t, selectedPage)}
          </DialogDescription>
        </DialogHeader>

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
              <LazySettingsGeneral />
            </AppSettingsPage>
            <AppSettingsPage page="appearance">
              <LazySettingsAppearance />
            </AppSettingsPage>
            <AppSettingsPage page="preferences">
              <LazySettingsPreferences />
            </AppSettingsPage>
            <AppSettingsPage page="layout">
              <LazySettingsLayout />
            </AppSettingsPage>
            <AppSettingsPage page="about">
              <LazySettingsAbout />
            </AppSettingsPage>
          </LibraryContent>
        </Library>
      </>
    );
  },
  { preloadDefaultPage: () => preloadSettingsPage[DEFAULT_PAGE]() },
);

function AppSettingsPageItem({ page }: { page: SettingsPageId }) {
  const { t } = useTranslation();
  const preload = preloadOnIntent(preloadSettingsPage[page]);

  return (
    <LibraryNavigationItem
      autoFocus={page === DEFAULT_PAGE}
      onFocus={preload}
      onPointerEnter={preload}
      value={page}
    >
      {getSettingsPageTitle(t, page)}
    </LibraryNavigationItem>
  );
}

function AppSettingsPage({ children, page }: { children: ReactNode; page: SettingsPageId }) {
  return (
    <Suspense fallback={null}>
      <LibraryPage className="space-y-4" value={page}>
        {children}
      </LibraryPage>
    </Suspense>
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
