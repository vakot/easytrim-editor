import process from "node:process";
import { fileURLToPath } from "node:url";

import { SUPPORTED_LOCALES, validateI18n } from "./i18n-validation.mjs";

const LOCALE_NAMES = {
  en: "English",
  ru: "Russian",
  sk: "Slovak",
};

const USAGE = [
  "Usage:",
  "  pnpm i18n:check",
  "  pnpm i18n:check --verbose",
  "  pnpm i18n:check --verbose <locale>",
].join("\n");

export function parseArguments(args) {
  if (args.length === 0) return { verbose: false };
  if (args[0] !== "--verbose") {
    const message =
      args.length === 1 && SUPPORTED_LOCALES.includes(args[0])
        ? "A locale filter requires --verbose."
        : "Invalid i18n:check arguments.";

    throw new Error(`${message}\n\n${USAGE}`);
  }
  if (args.length > 2) throw new Error(`Invalid i18n:check arguments.\n\n${USAGE}`);

  const localeFilter = args[1];
  if (localeFilter && !SUPPORTED_LOCALES.includes(localeFilter)) {
    throw new Error(
      `Unsupported locale: ${localeFilter}\nSupported locales: ${SUPPORTED_LOCALES.join(", ")}`,
    );
  }

  return { verbose: true, localeFilter };
}

export function formatCoverage(coverage, { localeFilter, verbose } = {}) {
  const lines = ["Translations:"];
  for (const result of coverage) {
    const label = LOCALE_NAMES[result.locale] ?? result.locale;
    const count = verbose ? `   ${result.translatedUnits}/${result.totalUnits}` : "";
    lines.push(`${label.padEnd(12)}${String(result.percentage).padStart(3)}%${count}`);
  }

  if (!verbose) return lines.join("\n");

  const detailedLocales = localeFilter
    ? coverage.filter((result) => result.locale === localeFilter)
    : coverage.filter((result) => result.missingUnits.length > 0);

  const missingSections = detailedLocales
    .filter((result) => result.missingUnits.length > 0)
    .map((result) => {
      const missingUnits = [...result.missingUnits].sort();
      return `${result.locale}:\n${missingUnits.map((key) => `  ${key}`).join("\n")}`;
    });

  if (missingSections.length > 0) {
    lines.push("", "Missing translation units:", ...missingSections);
  }

  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = await validateI18n(process.cwd());
    console.log(formatCoverage(report.coverage, options));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
