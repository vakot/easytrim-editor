import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectThemePreference,
  themePreferenceChanged,
} from "@/app/store/slices/preferences-slice";

type Theme = "system" | "light" | "dark";

function getThemeCommandId(theme: Theme) {
  return `theme-${theme}` as const;
}

function useThemeCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentTheme = useAppSelector(selectThemePreference);
  const labels = {
    system: t("settings.options.themes.system"),
    light: t("settings.options.themes.light"),
    dark: t("settings.options.themes.dark"),
  };

  return (["system", "light", "dark"] as const).map((theme) => ({
    checked: currentTheme === theme,
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
    id: getThemeCommandId(theme),
    label: labels[theme],
    searchTerms: [labels[theme], "theme", "appearance"],
    variant: "default" as const,
  }));
}

export { getThemeCommandId, useThemeCommands };
