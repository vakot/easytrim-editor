import type { TFunction } from "i18next";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  FolderInput,
  LoaderCircle,
  RefreshCw,
  ScrollText,
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

import {
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import type { UpdateStatus } from "@/app/contexts/app-updates-context";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { GithubIcon, KofiIcon } from "@/components/brand-icons";

function MenuBarHelp() {
  const { t } = useTranslation();
  const { availableVersion, status: updateStatus } = useAppUpdates();

  const { icon: updateIcon } = getUpdateDetails(updateStatus, availableVersion, t);

  return (
    <MenubarMenu value="help">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("app.labels.help")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <ApplicationCommandMenuItem asChild commandId="open-changelog">
            <MenubarItem inset>
              <MenubarIcon>
                <ScrollText aria-hidden="true" />
              </MenubarIcon>
              <ApplicationCommandLabel />
            </MenubarItem>
          </ApplicationCommandMenuItem>
          <ApplicationCommandMenuItem asChild commandId="check-for-updates">
            <MenubarItem inset keepOpen>
              <MenubarIcon>{updateIcon}</MenubarIcon>
              <ApplicationCommandLabel />
            </MenubarItem>
          </ApplicationCommandMenuItem>
          <ApplicationCommandMenuItem asChild commandId="open-project-page">
            <MenubarItem inset>
              <MenubarIcon>
                <GithubIcon aria-hidden="true" />
              </MenubarIcon>
              <ApplicationCommandLabel />
            </MenubarItem>
          </ApplicationCommandMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <ApplicationCommandMenuItem asChild commandId="show-logs">
            <MenubarItem inset>
              <MenubarIcon>
                <FolderInput aria-hidden="true" />
              </MenubarIcon>
              <ApplicationCommandLabel />
            </MenubarItem>
          </ApplicationCommandMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <ApplicationCommandMenuItem asChild commandId="support-project">
            <MenubarItem inset>
              <MenubarIcon>
                <KofiIcon aria-hidden="true" />
              </MenubarIcon>
              <ApplicationCommandLabel />
            </MenubarItem>
          </ApplicationCommandMenuItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <ApplicationCommandMenuItem asChild commandId="open-release-page">
            <MenubarItem inset>
              <MenubarIcon>
                <ExternalLink aria-hidden="true" />
              </MenubarIcon>
              <ApplicationCommandLabel />
            </MenubarItem>
          </ApplicationCommandMenuItem>
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

export { MenuBarHelp };
