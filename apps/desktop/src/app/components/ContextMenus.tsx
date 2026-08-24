import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  LoaderCircle,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SpectrumWheel } from "@/app/components/PrimaryColorSelector";
import {
  CUSTOM_PRIMARY_COLOR,
  PRIMARY_COLORS,
  isCustomPrimaryColor,
  resolvePrimaryColor,
  type PrimaryColor,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/use-theme";
import { useAppUpdates } from "@/app/update-context";
import { BrandIcon } from "@/components/BrandIcon";
import { githubBrandIcon, kofiBrandIcon } from "@/components/brand-icons";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";
import { openExternalUrl } from "@/lib/open-external-url";
import packageJson from "../../../../../package.json";

interface ContextMenusProps {
  isChoosingSource: boolean;
  hasSource?: boolean;
  canSave: boolean;
  canExport: boolean;
  onChooseSource: () => void;
  onCloseFile?: () => void;
  onSave: () => void;
  onExport: () => void;
}

const themeIcons = { system: Monitor, light: Sun, dark: Moon } as const;
type ContextMenuId = "file" | "view" | "help";

const CHANGELOG_URL = "https://github.com/vakot/easytrim-editor/releases";
const PROJECT_PAGE_URL = "https://github.com/vakot/easytrim-editor";
const SUPPORT_PROJECT_URL = "https://ko-fi.com/vakot";
const VERSION_RELEASE_URL = `https://github.com/vakot/easytrim-editor/releases/tag/v${packageJson.version}`;

const colorClasses: Record<Exclude<PrimaryColor, `#${string}`>, string> = {
  amber: "bg-[#efbf04]",
  rose: "bg-[#e85d75]",
  violet: "bg-[#8b6ee8]",
  blue: "bg-[#4299e1]",
  emerald: "bg-[#32a876]",
};

export function ContextMenus({
  isChoosingSource,
  hasSource = false,
  canSave,
  canExport,
  onChooseSource,
  onCloseFile = () => undefined,
  onSave,
  onExport,
}: ContextMenusProps) {
  const { t, i18n } = useTranslation();
  const {
    status: updateStatus,
    availableVersion,
    isInstalling,
    checkForUpdates,
    installUpdate,
  } = useAppUpdates();
  const {
    preference,
    primaryColor,
    primaryColorKey,
    customPrimaryColor,
    previewPrimaryColor,
    setPreference,
    setPrimaryColor,
  } = useTheme();
  const [openMenu, setOpenMenu] = useState<ContextMenuId | null>(null);
  const [switchingMenu, setSwitchingMenu] = useState<ContextMenuId | null>(null);
  const [previewColor, setPreviewColor] = useState<PrimaryColor | null>(null);
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
  const CurrentThemeIcon = themeIcons[preference];
  const displayedPrimaryColor = previewColor ?? primaryColor;
  const displayedCustomColor = previewColor ?? customPrimaryColor;
  const clearPreview = () => {
    setPreviewColor(null);
    previewPrimaryColor(null);
  };
  const closeMenu = () => {
    clearPreview();
    setSwitchingMenu(null);
    setOpenMenu(null);
  };

  const menuProps = (id: ContextMenuId) => ({
    open: openMenu === id,
    onOpenChange: (isOpen: boolean) => {
      if (!isOpen) clearPreview();
      if (!isOpen && switchingMenu === id) {
        setSwitchingMenu(null);
        return;
      }

      if (isOpen) setSwitchingMenu(null);
      setOpenMenu((current) => {
        if (isOpen) return id;
        return current === id ? null : current;
      });
    },
    onTriggerPointerEnter: () => {
      if (openMenu !== null && openMenu !== id) {
        setSwitchingMenu(id);
        setOpenMenu(id);
      }
    },
  });

  const themeOptions: ContextMenuOption[] = (["system", "light", "dark"] as const).map((value) => {
    const Icon = themeIcons[value];
    return {
      id: `theme-${value}`,
      label: t(`theme.${value}`),
      hint: <Icon className="size-4" aria-hidden="true" />,
      selected: value === preference,
      shouldCloseOnClick: false,
      onSelect: () => setPreference(value),
    };
  });

  const colorOptions: ContextMenuOption[] = [
    ...PRIMARY_COLORS.map((color) => ({
      id: `color-${color}`,
      leading: <ColorSample color={color} selected={color === primaryColorKey} />,
      label: t(`themeColor.${color}`),
      hint: resolvePrimaryColor(color).toUpperCase(),
      selected: color === primaryColorKey,
      shouldCloseOnClick: false,
      onSelect: () => setPrimaryColor(color),
    })),
    {
      id: "color-custom",
      leading: (
        <ColorSample
          color={displayedCustomColor}
          selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
        />
      ),
      label: t("themeColor.custom"),
      hint: displayedCustomColor.toUpperCase(),
      selected: primaryColorKey === CUSTOM_PRIMARY_COLOR,
      shouldCloseOnClick: false,
      onSelect: () => {
        setPreviewColor(null);
        setPrimaryColor(customPrimaryColor);
      },
      openSubmenuOnClick: false,
      submenuContent: (
        <CustomColorPickerPanel
          previewColor={previewColor}
          onPreviewChange={setPreviewColor}
          onClose={closeMenu}
        />
      ),
    },
  ];

  const languageOptions: ContextMenuOption[] = (["en", "sk"] as const).map((language) => ({
    id: `language-${language}`,
    label: t(language === "en" ? "language.english" : "language.slovak"),
    hint: language.toUpperCase(),
    selected: language === currentLanguage,
    onSelect: () => void i18n.changeLanguage(language as SupportedLanguage),
  }));

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
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
    ) : updateStatus === "available" ? (
      <Download className="size-4" aria-hidden="true" />
    ) : updateStatus === "up-to-date" ? (
      <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
    ) : updateStatus === "error" ? (
      <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
    ) : updateStatus === "idle" ? (
      <RefreshCw className="size-4" aria-hidden="true" />
    ) : undefined;

  // TODO: Move Language to a dedicated Settings menu once Settings is introduced.

  return (
    <nav className="flex h-full items-center gap-0.5" aria-label={t("app.topBarMenus.label")}>
      <ContextMenu
        {...menuProps("file")}
        label={t("app.topBarMenus.file")}
        options={[
          {
            id: "open-file",
            label: t("app.topBarMenus.openFile"),
            hint: "Ctrl+O",
            disabled: isChoosingSource,
            onSelect: onChooseSource,
          },
          {
            id: "close-file",
            label: t("app.topBarMenus.closeFile"),
            hint: "Ctrl+Q",
            disabled: !hasSource,
            onSelect: onCloseFile,
          },
          { id: "file-divider", separator: true },
          {
            id: "save-lossless-cut",
            label: t("app.topBarMenus.saveLosslessCut"),
            hint: "Ctrl+S",
            disabled: !canSave,
            onSelect: onSave,
          },
          {
            id: "optimize-export",
            label: t("app.topBarMenus.optimizeExport"),
            hint: "Ctrl+E",
            disabled: !canExport,
            onSelect: onExport,
          },
        ]}
      />
      <ContextMenu
        {...menuProps("view")}
        label={t("app.topBarMenus.view")}
        options={[
          {
            id: "theme",
            label: t("app.topBarMenus.theme"),
            hint: <CurrentThemeIcon className="size-4" aria-label={t(`theme.${preference}`)} />,
            shouldCloseOnClick: false,
            submenu: themeOptions,
          },
          {
            id: "color",
            label: t("app.topBarMenus.color"),
            hint: <ColorSample color={displayedPrimaryColor} />,
            shouldCloseOnClick: false,
            submenu: colorOptions,
          },
          { id: "view-divider", separator: true },
          {
            id: "language",
            label: t("app.topBarMenus.language"),
            hint: currentLanguage.toUpperCase(),
            shouldCloseOnClick: false,
            submenu: languageOptions,
          },
        ]}
      />
      <ContextMenu
        {...menuProps("help")}
        label={t("app.topBarMenus.help")}
        options={[
          {
            id: "changelog",
            label: t("app.topBarMenus.changelog"),
            hint: <ExternalLink className="size-4" aria-hidden="true" />,
            onSelect: () => void openExternalUrl(CHANGELOG_URL),
          },
          {
            id: "check-for-updates",
            label: updateLabel,
            hint: updateHint,
            disabled: updateStatus === "checking" || isInstalling,
            shouldCloseOnClick: false,
            onSelect: () =>
              void (updateStatus === "available" ? installUpdate() : checkForUpdates()),
          },
          {
            id: "project-page",
            label: t("app.topBarMenus.projectPage"),
            hint: <BrandIcon className="size-4" icon={githubBrandIcon} />,
            onSelect: () => void openExternalUrl(PROJECT_PAGE_URL),
          },
          { id: "help-divider-support", separator: true },
          {
            id: "support-project",
            label: t("app.topBarMenus.supportProject"),
            hint: <BrandIcon className="size-4" icon={kofiBrandIcon} />,
            onSelect: () => void openExternalUrl(SUPPORT_PROJECT_URL),
          },
          { id: "help-divider-version", separator: true },
          {
            id: "version",
            label: t("app.topBarMenus.version", { version: packageJson.version }),
            hint: <ExternalLink className="size-4" aria-hidden="true" />,
            onSelect: () => void openExternalUrl(VERSION_RELEASE_URL),
          },
        ]}
      />
    </nav>
  );
}

function CustomColorPickerPanel({
  previewColor,
  onPreviewChange,
  onClose,
}: {
  previewColor: PrimaryColor | null;
  onPreviewChange: (color: PrimaryColor | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { customPrimaryColor, previewPrimaryColor, setPrimaryColor } = useTheme();
  const [hexValue, setHexValue] = useState<string>(customPrimaryColor.slice(1));
  const selectedColor = resolvePrimaryColor(previewColor ?? customPrimaryColor);

  const preview = (color: PrimaryColor) => {
    onPreviewChange(color);
    setHexValue(resolvePrimaryColor(color).slice(1));
    previewPrimaryColor(color);
  };
  const commit = (color: PrimaryColor) => {
    onPreviewChange(null);
    setHexValue(resolvePrimaryColor(color).slice(1));
    setPrimaryColor(color);
  };
  const cancel = () => {
    onPreviewChange(null);
    setHexValue(customPrimaryColor.slice(1));
    previewPrimaryColor(null);
  };
  const updateHexValue = (value: string) => {
    setHexValue(value);
    const color = `#${value}`;
    if (isCustomPrimaryColor(color)) commit(color);
  };

  return (
    <div className="w-auto space-y-3 p-2" onPointerMove={(event) => event.stopPropagation()}>
      <SpectrumWheel
        color={selectedColor}
        onPreview={preview}
        onCommit={commit}
        onCancel={cancel}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("themeColor.custom")}</span>
        <div className="flex h-7 w-18 items-center rounded-lg border border-input bg-transparent px-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none shrink-0 font-mono text-sm text-muted-foreground"
            data-slot="hex-prefix"
          >
            #
          </span>
          <Input
            aria-label={`${t("themeColor.custom")} hex`}
            className="h-full w-auto min-w-0 flex-1 rounded-none border-0 px-0 py-0 font-mono text-sm text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
            maxLength={6}
            onChange={(event) =>
              updateHexValue(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
            }
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const color = `#${hexValue}`;
              if (isCustomPrimaryColor(color)) commit(color);
              onClose();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            pattern="[0-9a-fA-F]{6}"
            spellCheck={false}
            value={hexValue}
          />
        </div>
      </div>
    </div>
  );
}

function ColorSample({ color, selected = false }: { color: PrimaryColor; selected?: boolean }) {
  const sampleClass = color.startsWith("#")
    ? undefined
    : colorClasses[color as Exclude<PrimaryColor, `#${string}`>];
  return (
    <span
      className={`size-3.5 rounded-full ring-1 ring-foreground/20 ${sampleClass ?? ""} ${selected ? "ring-2 ring-foreground ring-offset-1 ring-offset-popover" : ""}`}
      style={sampleClass ? undefined : { backgroundColor: resolvePrimaryColor(color) }}
      aria-hidden="true"
    />
  );
}
