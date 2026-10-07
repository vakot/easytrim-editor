import { ChevronsUpDown } from "lucide-react";
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
import { SUPPORTED_LANGUAGES } from "@/domain/languages";
import { isSupportedLanguage } from "@/i18n/resources";

import { SettingRow, SettingsSection } from "../components/SettingRow";

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
          languages={SUPPORTED_LANGUAGES}
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
              <LanguageSelectorValue className="flex-1" />
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
