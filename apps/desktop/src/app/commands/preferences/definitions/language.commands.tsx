import { FileOutputIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";

type Language = "en" | "sk" | "ru";

// Always show each language's native name; never translate these labels for the active language.
const languageOptions = [
  { code: "en", label: "English" },
  { code: "sk", label: "Slovenčina" },
  { code: "ru", label: "Русский" },
] as const satisfies readonly { code: Language; label: string }[];

function getLanguageCommandId(language: Language) {
  return `language-${language}` as const;
}

function useLanguageCommands() {
  const { i18n } = useTranslation();

  return languageOptions.map(({ code, label }) => ({
    checked: i18n.resolvedLanguage === code,
    closePaletteOnSelect: false,
    enabled: true,
    icon: <FileOutputIcon aria-hidden="true" />,
    async run() {
      await i18n.changeLanguage(code);
    },
    id: getLanguageCommandId(code),
    label,
    searchTerms: commandSearchTerms(`${label}|language`),
    variant: "default" as const,
  }));
}

export { getLanguageCommandId, useLanguageCommands };
