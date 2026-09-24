import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";

type LanguageCode = "en" | "sk" | "ru";

// Always show each language's native name; never translate these labels for the active language.
const languageOptions = [
  { code: "en", label: "English" },
  { code: "sk", label: "Slovenčina" },
  { code: "ru", label: "Русский" },
] as const satisfies readonly { code: LanguageCode; label: string }[];

function getLanguageCommandId(language: LanguageCode) {
  return `language-${language}` as const;
}

function useLanguageCommands() {
  const { i18n } = useTranslation();

  return languageOptions.map(({ code, label }) => ({
    checked: i18n.resolvedLanguage === code,
    keepOpen: true,
    enabled: true,
    icon: (
      <span
        aria-hidden="true"
        className="inline-flex size-4 items-center justify-center font-mono text-[10px] font-semibold text-muted-foreground group-data-selected/command-item:text-foreground"
      >
        {code.toUpperCase()}
      </span>
    ),
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
