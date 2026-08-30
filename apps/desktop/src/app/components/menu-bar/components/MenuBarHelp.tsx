import type { TFunction } from "i18next";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

import type { UpdateStatus } from "@/app/contexts/app-updates-context";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { GithubIcon, KofiIcon } from "@/components/brand-icons";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";

const CHANGELOG_URL = "https://github.com/vakot/easytrim-editor/releases";
const PROJECT_PAGE_URL = "https://github.com/vakot/easytrim-editor";
const SUPPORT_PROJECT_URL = "https://ko-fi.com/vakot";

export function MenuBarHelp() {
  const { t } = useTranslation();
  const currentVersion = getCurrentVersion();
  const {
    availableVersion,
    checkForUpdates,
    installUpdate,
    isInstalling,
    status: updateStatus,
  } = useAppUpdates();

  const { icon: updateIcon, label: updateLabel } = getUpdateDetails(
    updateStatus,
    availableVersion,
    t,
  );

  return (
    <MenubarMenu value="help">
      <MenubarTrigger asChild>
        <Button
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("app.labels.help")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <MenubarItem inset onSelect={() => void openExternalUrl(CHANGELOG_URL)}>
            <MenubarIcon>
              <ExternalLink aria-hidden="true" />
            </MenubarIcon>
            {t("support.actions.changelog")}
          </MenubarItem>
          <MenubarItem
            disabled={updateStatus === "checking" || isInstalling}
            inset
            keepOpen
            onSelect={() => {
              void (updateStatus === "available" ? installUpdate() : checkForUpdates());
            }}
            variant={updateStatus === "up-to-date" ? "success" : "default"}
          >
            <MenubarIcon>{updateIcon}</MenubarIcon>
            {updateLabel}
          </MenubarItem>
          <MenubarItem inset onSelect={() => void openExternalUrl(PROJECT_PAGE_URL)}>
            <MenubarIcon>
              <GithubIcon aria-hidden="true" />
            </MenubarIcon>
            {t("support.actions.projectPage")}
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem inset onSelect={() => void openExternalUrl(SUPPORT_PROJECT_URL)}>
            <MenubarIcon>
              <KofiIcon aria-hidden="true" />
            </MenubarIcon>
            {t("support.actions.projectSupport")}
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem
            inset
            onSelect={() =>
              void openExternalUrl(`${PROJECT_PAGE_URL}/releases/tag/v${currentVersion}`)
            }
          >
            <MenubarIcon>
              <ExternalLink aria-hidden="true" />
            </MenubarIcon>
            {t("app.labels.version", { version: currentVersion })}
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}

function getUpdateDetails(
  updateStatus: UpdateStatus,
  availableVersion: string | null,
  t: TFunction,
): {
  icon: React.ReactNode;
  label: string;
} {
  switch (updateStatus) {
    case "available":
      return {
        label: availableVersion ? t("app.actions.update") : t("app.actions.checkForUpdates"),
        icon: availableVersion ? <Download aria-hidden="true" /> : <RefreshCw aria-hidden="true" />,
      };
    case "checking":
      return {
        label: t("app.status.checkingForUpdates"),
        icon: <LoaderCircle aria-hidden="true" className="animate-spin" />,
      };
    case "idle":
      return { label: t("app.actions.checkForUpdates"), icon: <RefreshCw aria-hidden="true" /> };
    case "up-to-date":
      return {
        label: t("app.status.upToDate"),
        icon: <CheckCircle2 aria-hidden="true" className="text-emerald-500" />,
      };
    case "error":
      return {
        label: t("app.actions.checkForUpdates"),
        icon: <CircleAlert aria-hidden="true" className="text-destructive" />,
      };

    default:
      return {
        label: t("app.actions.checkForUpdates"),
        icon: <RefreshCw aria-hidden="true" />,
      };
  }
}
