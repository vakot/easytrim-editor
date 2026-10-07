import { ChevronsUpDown, ExternalLink } from "lucide-react";
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
import { openExternalUrl } from "@/lib/open-external-url.utils";

import { SettingRow, SettingsSection } from "../components/SettingRow";

const TRANSLATION_GUIDE_URL =
  "https://github.com/vakot/easytrim-editor/blob/master/apps/desktop/src/i18n/README.md";

function SettingsGeneral() {
  const { i18n, t } = useTranslation();
  const language = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <SettingsSection title={t("settings.general.language.label")}>
      <SettingRow
        description={t("settings.general.language.description")}
        label={t("settings.general.language.label")}
      >
        <div className="flex flex-col items-start gap-2">
          <LanguageSelector
            languages={SUPPORTED_LANGUAGES}
            onValueChange={(nextLanguage) => {
              if (isSupportedLanguage(nextLanguage)) void i18n.changeLanguage(nextLanguage);
            }}
            value={language}
          >
            <LanguageSelectorTrigger>
              <Button
                aria-label={t("settings.general.language.label")}
                className="w-44 justify-start"
                type="button"
                variant="outline"
              >
                <LanguageSelectorValue className="flex-1" />
                <ChevronsUpDown
                  aria-hidden="true"
                  className="ml-auto size-4 text-muted-foreground"
                />
              </Button>
            </LanguageSelectorTrigger>
            <LanguageSelectorContent>
              <LanguageSelectorInput
                aria-label={t("settings.general.language.search")}
                placeholder={t("settings.general.language.search")}
              />
              <LanguageSelectorList />
            </LanguageSelectorContent>
          </LanguageSelector>
          <a
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            href={TRANSLATION_GUIDE_URL}
            onClick={(event) => {
              event.preventDefault();
              void openExternalUrl(TRANSLATION_GUIDE_URL);
            }}
          >
            <span>{t("settings.general.language.helpTranslate")}</span>
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        </div>
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsGeneral };
