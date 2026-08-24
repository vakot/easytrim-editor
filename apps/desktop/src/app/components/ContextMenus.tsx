import { Monitor, Moon, Sun } from "lucide-react";
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
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

interface ContextMenusProps {
  isChoosingSource: boolean;
  canSave: boolean;
  canExport: boolean;
  onChooseSource: () => void;
  onSave: () => void;
  onExport: () => void;
}

const themeIcons = { system: Monitor, light: Sun, dark: Moon } as const;
type TopBarMenuId = "file" | "edit" | "view";

const colorClasses: Record<Exclude<PrimaryColor, `#${string}`>, string> = {
  amber: "bg-[#efbf04]",
  rose: "bg-[#e85d75]",
  violet: "bg-[#8b6ee8]",
  blue: "bg-[#4299e1]",
  emerald: "bg-[#32a876]",
};

export function ContextMenus({
  isChoosingSource,
  canSave,
  canExport,
  onChooseSource,
  onSave,
  onExport,
}: ContextMenusProps) {
  const { t, i18n } = useTranslation();
  const {
    preference,
    primaryColor,
    primaryColorKey,
    customPrimaryColor,
    previewPrimaryColor,
    setPreference,
    setPrimaryColor,
  } = useTheme();
  const [openMenu, setOpenMenu] = useState<TopBarMenuId | null>(null);
  const [switchingMenu, setSwitchingMenu] = useState<TopBarMenuId | null>(null);
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

  const menuProps = (id: TopBarMenuId) => ({
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
        ]}
      />
      <ContextMenu
        {...menuProps("edit")}
        label={t("app.topBarMenus.edit")}
        options={[
          {
            id: "save",
            label: t("app.topBarMenus.save"),
            hint: "Ctrl+S",
            disabled: !canSave,
            onSelect: onSave,
          },
          {
            id: "optimized-export",
            label: t("app.topBarMenus.optimizedExport"),
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
          {
            id: "language",
            label: t("app.topBarMenus.language"),
            hint: currentLanguage.toUpperCase(),
            shouldCloseOnClick: false,
            submenu: languageOptions,
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
