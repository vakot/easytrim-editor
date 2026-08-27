import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { BrandIcon } from "@/components/brand-icon";
import { githubBrandIcon, kofiBrandIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemIcon,
  MenuItemLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { openExternalUrl } from "@/lib/open-external-url";
import packageJson from "../../../../../../../../package.json";

import type { MenuNavigation } from "../../types";

const CHANGELOG_URL = "https://github.com/vakot/easytrim-editor/releases";
const PROJECT_PAGE_URL = "https://github.com/vakot/easytrim-editor";
const SUPPORT_PROJECT_URL = "https://ko-fi.com/vakot";

export function HelpMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t } = useTranslation();
  const {
    status: updateStatus,
    availableVersion,
    isInstalling,
    checkForUpdates,
    installUpdate,
  } = useAppUpdates();
  const updateLabel =
    updateStatus === "checking"
      ? t("app.topBarMenus.checkingForUpdates")
      : updateStatus === "up-to-date"
        ? t("app.topBarMenus.upToDate")
        : updateStatus === "available" && availableVersion
          ? t("app.topBarMenus.updateTo", { version: availableVersion })
          : t("app.topBarMenus.checkForUpdates");

  const updateHint =
    updateStatus === "checking" ? (
      <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
    ) : updateStatus === "available" ? (
      <Download className="size-3" aria-hidden="true" />
    ) : updateStatus === "up-to-date" ? (
      <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
    ) : updateStatus === "error" ? (
      <CircleAlert className="size-3 text-destructive" aria-hidden="true" />
    ) : updateStatus === "idle" ? (
      <RefreshCw className="size-3" aria-hidden="true" />
    ) : undefined;

  return (
    <Menu modal={false} open={navigation.open} onOpenChange={navigation.onOpenChange}>
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          Help
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => void openExternalUrl(CHANGELOG_URL)}>
          <MenuItemIcon>
            <ExternalLink className="size-3" aria-hidden="true" />
          </MenuItemIcon>
          <MenuItemLabel>{t("app.topBarMenus.changelog")}</MenuItemLabel>
        </MenuItem>
        <MenuItem
          disabled={updateStatus === "checking" || isInstalling}
          onSelect={(event) => {
            event.preventDefault();
            void (updateStatus === "available" ? installUpdate() : checkForUpdates());
          }}
        >
          <MenuItemIcon>{updateHint}</MenuItemIcon>
          <MenuItemLabel>{updateLabel}</MenuItemLabel>
        </MenuItem>
        <MenuItem onSelect={() => void openExternalUrl(PROJECT_PAGE_URL)}>
          <MenuItemIcon>
            <BrandIcon className="size-3" icon={githubBrandIcon} />
          </MenuItemIcon>
          <MenuItemLabel>{t("app.topBarMenus.projectPage")}</MenuItemLabel>
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => void openExternalUrl(SUPPORT_PROJECT_URL)}>
          <MenuItemIcon>
            <BrandIcon className="size-3" icon={kofiBrandIcon} />
          </MenuItemIcon>
          <MenuItemLabel>{t("app.topBarMenus.supportProject")}</MenuItemLabel>
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() =>
            void openExternalUrl(`${PROJECT_PAGE_URL}/releases/tag/v${packageJson.version}`)
          }
        >
          <MenuItemIcon>
            <ExternalLink className="size-3" aria-hidden="true" />
          </MenuItemIcon>
          <MenuItemLabel>
            {t("app.topBarMenus.version", { version: packageJson.version })}
          </MenuItemLabel>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
