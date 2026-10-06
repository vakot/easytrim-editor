import { ChevronsUpDown, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { LANGUAGE_CATALOG } from "@/domain/languages";
import { isSupportedLanguage } from "@/i18n/resources";

import { SettingRow, SettingsSection } from "../components/SettingRow";

const supportedLanguages = LANGUAGE_CATALOG.filter(({ code }) => isSupportedLanguage(code));

function SettingsGeneral() {
  const { i18n, t } = useTranslation();
  const language = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <SettingsSection title={t("settings.labels.language")}>
      <SettingRow
        description={t("settings.pages.general.languageDescription")}
        label={t("settings.labels.language")}
      >
        <LanguageSelector
          languages={supportedLanguages}
          onValueChange={(nextLanguage) => {
            if (isSupportedLanguage(nextLanguage)) void i18n.changeLanguage(nextLanguage);
          }}
          value={language}
        >
          <LanguageSelectorTrigger>
            <Button
              aria-label={t("settings.labels.language")}
              className="w-44 justify-start"
              type="button"
              variant="outline"
            >
              <Languages aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-left">
                <LanguageSelectorValue />
              </span>
              <ChevronsUpDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
            </Button>
          </LanguageSelectorTrigger>
          <LanguageSelectorContent>
            <LanguageSelectorInput
              aria-label={t("common.labels.searchLanguages")}
              placeholder={t("common.labels.searchLanguages")}
            />
            <LanguageSelectorList />
          </LanguageSelectorContent>
        </LanguageSelector>
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsGeneral };
