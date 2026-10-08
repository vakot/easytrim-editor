import GB from "country-flag-icons/react/3x2/GB";
import RU from "country-flag-icons/react/3x2/RU";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorFlag,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { SUPPORTED_LANGUAGES } from "@/domain/languages";
import { isSupportedLanguage, type SupportedLanguage, translationCoverage } from "@/i18n/resources";
import { openExternalUrl } from "@/lib/open-external-url.utils";

import { SettingRow, SettingsSection } from "../components/SettingRow";

const TRANSLATION_GUIDE_URL =
  "https://github.com/vakot/easytrim-editor/blob/master/apps/desktop/src/i18n/README.md";

const SETTINGS_LANGUAGES = SUPPORTED_LANGUAGES.map((language) => ({
  ...language,
  flag:
    language.region === "GB" ? (
      <GB aria-hidden="true" className="block h-auto! w-full!" />
    ) : (
      <RU aria-hidden="true" className="block h-auto! w-full!" />
    ),
}));

function SettingsGeneral() {
  const { i18n, t } = useTranslation();
  const language = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <SettingsSection title={t("settings.general.language.label")}>
      <SettingRow
        description={t("settings.general.language.description")}
        label={t("settings.general.language.label")}
      >
        <div className="inline-grid min-w-44 items-end gap-2">
          <LanguageSelector
            label={t("settings.general.language.search")}
            languages={SETTINGS_LANGUAGES}
            onValueChange={(nextLanguage) => {
              if (isSupportedLanguage(nextLanguage)) void i18n.changeLanguage(nextLanguage);
            }}
            value={language}
          >
            <LanguageSelectorTrigger>
              <Button
                aria-label={t("settings.general.language.label")}
                className="w-full justify-start"
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
                placeholder={t("settings.general.language.searchPlaceholder")}
              />
              <LanguageSelectorList
                emptyState={t("settings.general.language.noResults")}
                renderOption={(option, { displayName }) => {
                  const percentage =
                    translationCoverage[option.code as SupportedLanguage].percentage;

                  return (
                    <>
                      <LanguageSelectorFlag className="col-start-1 row-start-1" language={option} />
                      <span className="col-start-2 row-start-1 min-w-0 truncate">
                        {displayName}
                      </span>
                      <div className="col-start-2 row-start-2 flex items-center gap-1">
                        <Progress
                          aria-label={t("settings.general.language.coverageAccessibleLabel", {
                            language: option.nativeName,
                            percentage,
                          })}
                          className="h-1"
                          value={percentage}
                        />
                        <span
                          aria-hidden="true"
                          className="w-[4ch] shrink-0 text-right text-xs tabular-nums"
                        >
                          {percentage}%
                        </span>
                      </div>
                    </>
                  );
                }}
              />
            </LanguageSelectorContent>
          </LanguageSelector>

          <a
            className="inline-flex w-full items-center justify-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
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
