import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

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

  const updateLabel =
    updateStatus === "checking"
      ? t("app.status.checkingForUpdates")
      : updateStatus === "up-to-date"
        ? t("app.status.upToDate")
        : updateStatus === "available" && availableVersion
          ? t("app.actions.updateTo", { version: availableVersion })
          : t("app.actions.checkForUpdates");

  const updateHint =
    updateStatus === "checking" ? (
      <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
    ) : updateStatus === "available" ? (
      <Download aria-hidden="true" className="size-3" />
    ) : updateStatus === "up-to-date" ? (
      <CheckCircle2 aria-hidden="true" className="size-3 text-emerald-500" />
    ) : updateStatus === "error" ? (
      <CircleAlert aria-hidden="true" className="size-3 text-destructive" />
    ) : updateStatus === "idle" ? (
      <RefreshCw aria-hidden="true" className="size-3" />
    ) : undefined;

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
          <MenubarItem
            icon={<ExternalLink aria-hidden="true" className="size-3" />}
            onSelect={() => void openExternalUrl(CHANGELOG_URL)}
          >
            {t("support.actions.changelog")}
          </MenubarItem>
          <MenubarItem
            disabled={updateStatus === "checking" || isInstalling}
            icon={updateHint}
            onSelect={(event) => {
              event.preventDefault();
              void (updateStatus === "available" ? installUpdate() : checkForUpdates());
            }}
          >
            {updateLabel}
          </MenubarItem>
          <MenubarItem
            icon={<GithubIcon className="size-3" />}
            onSelect={() => void openExternalUrl(PROJECT_PAGE_URL)}
          >
            {t("support.actions.projectPage")}
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem
            icon={<KofiIcon className="size-3" />}
            onSelect={() => void openExternalUrl(SUPPORT_PROJECT_URL)}
          >
            {t("support.actions.projectSupport")}
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem
            icon={<ExternalLink aria-hidden="true" className="size-3" />}
            onSelect={() =>
              void openExternalUrl(`${PROJECT_PAGE_URL}/releases/tag/v${currentVersion}`)
            }
          >
            {t("app.labels.version", { version: currentVersion })}
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
