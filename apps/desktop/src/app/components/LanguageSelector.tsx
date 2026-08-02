import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n/resources";

const languageNameKeys = {
  en: "language.english",
  sk: "language.slovak",
} as const;

export function LanguageSelector({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const currentLanguage = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <Select
      value={currentLanguage}
      onValueChange={(language) => void i18n.changeLanguage(language as SupportedLanguage)}
    >
      <SelectTrigger variant="solid" className={className} aria-label={t("language.label")}>
        <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(languageNameKeys).map(([language, key]) => (
          <SelectItem key={language} value={language}>
            {t(key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
