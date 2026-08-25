import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { selectThemePreference, themePreferenceChanged } from "@/app/store/slices/theme-slice";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useTheme } from "@/app/theme/use-theme";
import type { ThemePreference } from "@/app/theme/theme";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "system", labelKey: "theme.system", Icon: Monitor },
  { value: "light", labelKey: "theme.light", Icon: Sun },
  { value: "dark", labelKey: "theme.dark", Icon: Moon },
] as const;

export function ThemeSelector({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const dispatch = useAppDispatch();
  const preference = useAppSelector(selectThemePreference);
  const currentThemeLabel =
    preference === "system"
      ? t("theme.systemSelection", { resolved: t(`theme.${resolvedTheme}`) })
      : t(`theme.${preference}`);
  const CurrentIcon = themeOptions.find((option) => option.value === preference)?.Icon ?? Monitor;

  return (
    <Select
      value={preference}
      onValueChange={(theme) => dispatch(themePreferenceChanged(theme as ThemePreference))}
    >
      <SelectTrigger
        variant="solid"
        className={cn("w-16 px-3", className)}
        aria-label={t("theme.selection", { theme: currentThemeLabel })}
      >
        <CurrentIcon className="size-4" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent>
        {themeOptions.map(({ value, labelKey, Icon }) => (
          <SelectItem key={value} value={value}>
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {t(labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
