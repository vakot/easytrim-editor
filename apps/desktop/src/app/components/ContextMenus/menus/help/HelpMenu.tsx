import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppUpdates } from "@/app/update-context";
import { BrandIcon } from "@/components/BrandIcon";
import { githubBrandIcon, kofiBrandIcon } from "@/components/brand-icons";
import { ContextMenu } from "@/components/ui/context-menu";
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
    <ContextMenu
      {...navigation}
      options={[
        {
          id: "changelog",
          children: t("app.topBarMenus.changelog"),
          icon: <ExternalLink className="size-3" aria-hidden="true" />,
          onSelect: () => void openExternalUrl(CHANGELOG_URL),
        },
        {
          id: "check-for-updates",
          children: updateLabel,
          icon: updateHint,
          disabled: updateStatus === "checking" || isInstalling,
          shouldCloseOnClick: false,
          onSelect: () => void (updateStatus === "available" ? installUpdate() : checkForUpdates()),
        },
        {
          id: "project-page",
          children: t("app.topBarMenus.projectPage"),
          icon: <BrandIcon className="size-3" icon={githubBrandIcon} />,
          onSelect: () => void openExternalUrl(PROJECT_PAGE_URL),
        },
        { id: "help-divider-support", separator: true },
        {
          id: "support-project",
          children: t("app.topBarMenus.supportProject"),
          icon: <BrandIcon className="size-3" icon={kofiBrandIcon} />,
          onSelect: () => void openExternalUrl(SUPPORT_PROJECT_URL),
        },
        { id: "help-divider-version", separator: true },
        {
          id: "version",
          children: t("app.topBarMenus.version", { version: packageJson.version }),
          icon: <ExternalLink className="size-3" aria-hidden="true" />,
          onSelect: () =>
            void openExternalUrl(`${PROJECT_PAGE_URL}/releases/tag/v${packageJson.version}`),
        },
      ]}
    >
      Help
    </ContextMenu>
  );
}
