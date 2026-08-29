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
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { GithubIcon, KofiIcon } from "@/components/brand-icons";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";

import type { MenuNavigation } from "../types";

const CHANGELOG_URL = "https://github.com/vakot/easytrim-editor/releases";
const PROJECT_PAGE_URL = "https://github.com/vakot/easytrim-editor";
const SUPPORT_PROJECT_URL = "https://ko-fi.com/vakot";

export function ContextMenuHelp({ navigation }: { navigation: MenuNavigation }) {
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
    <Menu modal={false} onOpenChange={navigation.onOpenChange} open={navigation.open}>
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("app.labels.help")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuGroup>
          <MenuItem
            icon={<ExternalLink aria-hidden="true" className="size-3" />}
            onSelect={() => void openExternalUrl(CHANGELOG_URL)}
          >
            {t("support.actions.changelog")}
          </MenuItem>
          <MenuItem
            disabled={updateStatus === "checking" || isInstalling}
            icon={updateHint}
            onSelect={(event) => {
              event.preventDefault();
              void (updateStatus === "available" ? installUpdate() : checkForUpdates());
            }}
          >
            {updateLabel}
          </MenuItem>
          <MenuItem
            icon={<GithubIcon className="size-3" />}
            onSelect={() => void openExternalUrl(PROJECT_PAGE_URL)}
          >
            {t("support.actions.projectPage")}
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem
            icon={<KofiIcon className="size-3" />}
            onSelect={() => void openExternalUrl(SUPPORT_PROJECT_URL)}
          >
            {t("support.actions.projectSupport")}
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem
            icon={<ExternalLink aria-hidden="true" className="size-3" />}
            onSelect={() =>
              void openExternalUrl(`${PROJECT_PAGE_URL}/releases/tag/v${currentVersion}`)
            }
          >
            {t("app.labels.version", { version: currentVersion })}
          </MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
