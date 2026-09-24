import { FileOutputIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";

type Language = "en" | "sk" | "ru";

const languageNames = {
  en: "English",
  sk: "Slovenčina",
  ru: "Русский",
} satisfies Record<Language, string>;

function getLanguageCommandId(language: Language) {
  return `language-${language}` as const;
}

function useLanguageCommands() {
  const { i18n } = useTranslation();

  return (["en", "sk", "ru"] as const).map((language) => ({
    checked: i18n.resolvedLanguage === language,
    enabled: true,
    icon: <FileOutputIcon aria-hidden="true" />,
    async run() {
      await i18n.changeLanguage(language);
    },
    id: getLanguageCommandId(language),
    label: languageNames[language],
    searchTerms: commandSearchTerms(`${languageNames[language]}|language`),
    variant: "default" as const,
  }));
}

export { getLanguageCommandId, useLanguageCommands };
