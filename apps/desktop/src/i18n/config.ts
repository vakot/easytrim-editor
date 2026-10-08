import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { STORAGE_KEYS } from "@/lib/storage.consts";
import { readStoredJson, writeStoredJson } from "@/lib/storage.utils";

import {
  DEFAULT_LANGUAGE,
  resolveLanguagePreference,
  resources,
  SUPPORTED_LANGUAGES,
} from "./resources";

const storedPreferences = readStoredJson<{ language?: unknown }>(STORAGE_KEYS.preferences);
const storedLanguage =
  typeof storedPreferences?.language === "string" ? storedPreferences.language : undefined;

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguagePreference(storedLanguage),
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
  const resolvedLanguage = resolveLanguagePreference(language);
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
  writeStoredJson(STORAGE_KEYS.preferences, { ...stored, language: resolvedLanguage });
});

export { i18n };
