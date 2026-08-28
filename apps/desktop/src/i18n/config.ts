import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { readStoredJson, STORAGE_KEYS, writeStoredJson } from "@/lib/storage";

import {
  DEFAULT_LANGUAGE,
  resolveInitialLanguage,
  resources,
  SUPPORTED_LANGUAGES,
} from "./resources";

const storedPreferences = readStoredJson<{ language?: unknown }>(STORAGE_KEYS.preferences);
const storedLanguage =
  typeof storedPreferences?.language === "string" ? storedPreferences.language : undefined;
const initialLanguage = storedLanguage ? resolveInitialLanguage([storedLanguage]) : undefined;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage ?? resolveInitialLanguage(),
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
i18n.on("languageChanged", (language) => {
  applyDocumentLanguage(language);
  const resolvedLanguage = resolveInitialLanguage([language]);
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
  writeStoredJson(STORAGE_KEYS.preferences, { ...stored, language: resolvedLanguage });
});

export default i18n;
