import { Monitor, Moon, Sun } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  primaryColorChanged,
  selectThemePreference,
  themePreferenceChanged,
} from "@/app/store/slices/preferences-slice";
import { ColorSample } from "@/components/ui/color";
import { PRIMARY_COLORS, resolvePrimaryColor } from "@/app/theme/theme";

function getThemeCommandId(theme: "system" | "light" | "dark") {
  return `theme-${theme}` as const;
}

function getPrimaryColorCommandId(color: (typeof PRIMARY_COLORS)[number]) {
  return `primary-color-${color}` as const;
}

function useAppearanceCommandGroup() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const themePreference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector((state) => state.preferences.primaryColor);
  const themeLabels = useMemo(
    () => ({
      dark: t("settings.options.themes.dark"),
      light: t("settings.options.themes.light"),
      system: t("settings.options.themes.system"),
    }),
    [t],
  );
  const colorLabels = useMemo(
    () => ({
      amber: t("settings.options.colors.amber"),
      blue: t("settings.options.colors.blue"),
      emerald: t("settings.options.colors.emerald"),
      rose: t("settings.options.colors.rose"),
      violet: t("settings.options.colors.violet"),
    }),
    [t],
  );
  const themeSection = useMemo(
    () => ({ id: "appearance-theme", label: t("app.labels.commandSections.appearanceTheme") }),
    [t],
  );
  const colorSection = useMemo(
    () => ({ id: "appearance-color", label: t("app.labels.commandSections.appearanceColor") }),
    [t],
  );

  return useMemo(
    () =>
      defineApplicationCommandGroup("appearance", [
        ...(["system", "light", "dark"] as const).map((theme) => ({
          checked: themePreference === theme,
          enabled: true,
          icon:
            theme === "system" ? (
              <Monitor aria-hidden="true" />
            ) : theme === "light" ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            ),
          run() {
            dispatch(themePreferenceChanged(theme));
          },
          id: `theme-${theme}` as const,
          label: themeLabels[theme],
          searchTerms: commandSearchTerms(`${themeLabels[theme]}|theme|appearance`),
          section: themeSection,
          variant: "default" as const,
        })),
        ...PRIMARY_COLORS.map((color) => ({
          checked: primaryColor === color,
          enabled: true,
          icon: <ColorSample aria-hidden="true" color={resolvePrimaryColor(color)} />,
          run() {
            dispatch(primaryColorChanged(color));
          },
          id: `primary-color-${color}` as const,
          label: colorLabels[color],
          searchTerms: commandSearchTerms(`${colorLabels[color]}|color|accent`),
          section: colorSection,
          variant: "default" as const,
        })),
      ]),
    [colorLabels, colorSection, dispatch, primaryColor, themeLabels, themePreference, themeSection],
  );
}

export { getPrimaryColorCommandId, getThemeCommandId, useAppearanceCommandGroup };
