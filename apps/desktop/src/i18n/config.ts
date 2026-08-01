import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  resolveInitialLanguage,
  resources,
  SUPPORTED_LANGUAGES,
} from "./resources";

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  load: "languageOnly",
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function applyDocumentLanguage(language: string | undefined) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language ?? DEFAULT_LANGUAGE;
  }
}

applyDocumentLanguage(i18n.resolvedLanguage);
i18n.on("languageChanged", applyDocumentLanguage);

export default i18n;
