import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";
import { PRIMARY_COLORS, resolvePrimaryColor, type PrimaryColor } from "@/app/theme/theme";
import { useTheme } from "@/app/theme/use-theme";

interface TopBarMenusProps {
  isChoosingSource: boolean;
  canSave: boolean;
  canExport: boolean;
  onChooseSource: () => void;
  onSave: () => void;
  onExport: () => void;
}

const themeIcons = { system: Monitor, light: Sun, dark: Moon } as const;

const colorClasses: Record<Exclude<PrimaryColor, `#${string}`>, string> = {
  amber: "bg-[#efbf04]",
  rose: "bg-[#e85d75]",
  violet: "bg-[#8b6ee8]",
  blue: "bg-[#4299e1]",
  emerald: "bg-[#32a876]",
};

export function TopBarMenus({
  isChoosingSource,
  canSave,
  canExport,
  onChooseSource,
  onSave,
  onExport,
}: TopBarMenusProps) {
  const { t, i18n } = useTranslation();
  const { preference, primaryColor, setPreference, setPrimaryColor } = useTheme();
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
  const CurrentThemeIcon = themeIcons[preference];

  const themeOptions: ContextMenuOption[] = (["system", "light", "dark"] as const).map((value) => {
    const Icon = themeIcons[value];
    return {
      id: `theme-${value}`,
      label: t(`theme.${value}`),
      hint: value === preference ? <Icon className="size-4" aria-hidden="true" /> : undefined,
      onSelect: () => setPreference(value),
    };
  });

  const colorOptions: ContextMenuOption[] = PRIMARY_COLORS.map((color) => ({
    id: `color-${color}`,
    label: t(`themeColor.${color}`),
    hint: <ColorSample color={color} selected={color === primaryColor} />,
    onSelect: () => setPrimaryColor(color),
  }));

  const languageOptions: ContextMenuOption[] = (["en", "sk"] as const).map((language) => ({
    id: `language-${language}`,
    label: t(language === "en" ? "language.english" : "language.slovak"),
    hint: language === currentLanguage ? language.toUpperCase() : undefined,
    onSelect: () => void i18n.changeLanguage(language as SupportedLanguage),
  }));

  return (
    <nav className="flex h-full items-center gap-0.5" aria-label={t("app.topBarMenus.label")}>
      <ContextMenu
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
        label={t("app.topBarMenus.view")}
        options={[
          {
            id: "theme",
            label: t("app.topBarMenus.theme"),
            hint: <CurrentThemeIcon className="size-4" aria-label={t(`theme.${preference}`)} />,
            submenu: themeOptions,
          },
          {
            id: "color",
            label: t("app.topBarMenus.color"),
            hint: <ColorSample color={primaryColor} />,
            submenu: colorOptions,
          },
          {
            id: "language",
            label: t("app.topBarMenus.language"),
            hint: currentLanguage.toUpperCase(),
            submenu: languageOptions,
          },
        ]}
      />
    </nav>
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
