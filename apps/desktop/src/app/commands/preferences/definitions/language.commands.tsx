import { FileOutputIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";

type Language = "en" | "sk" | "ru";
function getLanguageCommandId(language: Language) {
  return `language-${language}` as const;
}

function useLanguageCommands() {
  const { i18n, t } = useTranslation();
  const labels = {
    en: t("settings.options.languages.english"),
    sk: t("settings.options.languages.slovak"),
    ru: t("settings.options.languages.russian"),
  };

  return (["en", "sk", "ru"] as const).map((language) => ({
    checked: i18n.resolvedLanguage === language,
    enabled: true,
    icon: <FileOutputIcon aria-hidden="true" />,
    async run() {
      await i18n.changeLanguage(language);
    },
    id: getLanguageCommandId(language),
    label: labels[language],
    searchTerms: commandSearchTerms(`${labels[language]}|language`),
    variant: "default" as const,
  }));
}

export { getLanguageCommandId, useLanguageCommands };
