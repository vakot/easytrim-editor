export interface Language {
  code: string;
  englishName: string;
  nativeName: string;
  region: string;
}

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    englishName: "English",
    nativeName: "English",
    region: "GB",
  },
  {
    code: "ru",
    englishName: "Russian",
    nativeName: "Русский",
    region: "RU",
  },
] as const satisfies readonly Language[];

type AudioMetadataLanguageDefinition = {
  code: string;
  metadataCode: string;
  region: string;
};

const AUDIO_METADATA_LANGUAGE_DEFINITIONS = [
  { code: "ar", metadataCode: "ara", region: "SA" },
  { code: "bg", metadataCode: "bul", region: "BG" },
  { code: "zh", metadataCode: "zho", region: "CN" },
  { code: "hr", metadataCode: "hrv", region: "HR" },
  { code: "cs", metadataCode: "ces", region: "CZ" },
  { code: "da", metadataCode: "dan", region: "DK" },
  { code: "nl", metadataCode: "nld", region: "NL" },
  { code: "en", metadataCode: "eng", region: "GB" },
  { code: "fi", metadataCode: "fin", region: "FI" },
  { code: "fr", metadataCode: "fra", region: "FR" },
  { code: "de", metadataCode: "deu", region: "DE" },
  { code: "el", metadataCode: "ell", region: "GR" },
  { code: "he", metadataCode: "heb", region: "IL" },
  { code: "hi", metadataCode: "hin", region: "IN" },
  { code: "hu", metadataCode: "hun", region: "HU" },
  { code: "id", metadataCode: "ind", region: "ID" },
  { code: "it", metadataCode: "ita", region: "IT" },
  { code: "ja", metadataCode: "jpn", region: "JP" },
  { code: "ko", metadataCode: "kor", region: "KR" },
  { code: "lv", metadataCode: "lav", region: "LV" },
  { code: "lt", metadataCode: "lit", region: "LT" },
  { code: "ms", metadataCode: "msa", region: "MY" },
  { code: "no", metadataCode: "nor", region: "NO" },
  { code: "pl", metadataCode: "pol", region: "PL" },
  { code: "pt", metadataCode: "por", region: "PT" },
  { code: "ro", metadataCode: "ron", region: "RO" },
  { code: "ru", metadataCode: "rus", region: "RU" },
  { code: "sr", metadataCode: "srp", region: "RS" },
  { code: "sk", metadataCode: "slk", region: "SK" },
  { code: "sl", metadataCode: "slv", region: "SI" },
  { code: "es", metadataCode: "spa", region: "ES" },
  { code: "sv", metadataCode: "swe", region: "SE" },
  { code: "th", metadataCode: "tha", region: "TH" },
  { code: "tr", metadataCode: "tur", region: "TR" },
  { code: "uk", metadataCode: "ukr", region: "UA" },
  { code: "vi", metadataCode: "vie", region: "VN" },
] as const satisfies readonly AudioMetadataLanguageDefinition[];

const englishNames = new Intl.DisplayNames(["en"], { type: "language" });

function capitalizeLanguageName(name: string, locale: string): string {
  const [firstCharacter, ...remainingCharacters] = [...name];
  return firstCharacter
    ? `${firstCharacter.toLocaleUpperCase(locale)}${remainingCharacters.join("")}`
    : name;
}

export const AUDIO_METADATA_LANGUAGES = AUDIO_METADATA_LANGUAGE_DEFINITIONS.map(
  ({ code, metadataCode, region }) => ({
    code,
    englishName: englishNames.of(code) ?? code,
    metadataCode,
    nativeName: capitalizeLanguageName(
      new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code,
      code,
    ),
    region,
  }),
);

function languageCodeFromMetadata(languageCode: string | undefined): string | undefined {
  const normalizedCode = languageCode?.toLowerCase();
  return AUDIO_METADATA_LANGUAGE_DEFINITIONS.find(
    ({ code, metadataCode }) => code === normalizedCode || metadataCode === normalizedCode,
  )?.code;
}

function metadataCodeFromLanguage(code: string): string {
  return (
    AUDIO_METADATA_LANGUAGE_DEFINITIONS.find((language) => language.code === code)?.metadataCode ??
    code
  );
}

function normalizeMetadataLanguageCode(languageCode: string | undefined): string | undefined {
  if (languageCode === undefined || languageCode === "") return undefined;
  const selectorCode = languageCodeFromMetadata(languageCode);
  return selectorCode === undefined ? languageCode : metadataCodeFromLanguage(selectorCode);
}

export { languageCodeFromMetadata, metadataCodeFromLanguage, normalizeMetadataLanguageCode };
