import { en } from "./locales/en";
import { sk } from "./locales/sk";
import type { TranslationSchema } from "./schema";

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "sk"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: { translation: en },
  sk: { translation: sk },
} as const satisfies Record<SupportedLanguage, { translation: TranslationSchema }>;

export function resolveInitialLanguage(
  preferredLanguages: readonly string[] = browserLanguages(),
): SupportedLanguage {
  for (const language of preferredLanguages) {
    const normalized = language.trim().toLowerCase().split(/[-_]/, 1)[0];
    if (isSupportedLanguage(normalized)) return normalized;
  }
  return DEFAULT_LANGUAGE;
}

export function isSupportedLanguage(language: string | undefined): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((supported) => supported === language);
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}
