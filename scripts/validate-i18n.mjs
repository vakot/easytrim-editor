import process from "node:process";

import { validateI18n } from "./i18n-validation.mjs";

try {
  const report = await validateI18n(process.cwd());
  console.log(
    `i18n validation passed: ${report.localeCount} locales, ${report.resourceLeafCount} resource leaves, ${report.usedResourceLeafCount} used leaves`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
