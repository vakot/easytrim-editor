import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/app/theme/use-theme";
import type { ThemePreference } from "@/app/theme/theme";

const themeOptions = [
  { value: "system", labelKey: "theme.system", Icon: Monitor },
  { value: "light", labelKey: "theme.light", Icon: Sun },
  { value: "dark", labelKey: "theme.dark", Icon: Moon },
] as const;

export function ThemeSelector({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const currentThemeLabel =
    preference === "system"
      ? t("theme.systemSelection", { resolved: t(`theme.${resolvedTheme}`) })
      : t(`theme.${preference}`);
  const CurrentIcon = themeOptions.find((option) => option.value === preference)?.Icon ?? Monitor;

  return (
    <Select value={preference} onValueChange={(theme) => setPreference(theme as ThemePreference)}>
      <SelectTrigger
        className={className}
        aria-label={t("theme.selection", { theme: currentThemeLabel })}
        title={t("theme.selection", { theme: currentThemeLabel })}
      >
        <CurrentIcon className="size-4" aria-hidden="true" />
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent align="end">
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
