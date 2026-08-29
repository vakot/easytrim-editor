import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseLocaleSource,
  scanTranslationSource,
  validateI18n,
  validateLocaleArchitecture,
  validateResourceUsage,
} from "../i18n-validation.mjs";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("validates the repository translation graph", async () => {
  const report = await validateI18n(repositoryRoot);

  assert.equal(report.localeCount, 2);
  assert.equal(report.resourceLeafCount, report.usedResourceLeafCount);
});

test("rejects dynamic keys and inline fallbacks", () => {
  const result = scanTranslationSource(
    `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t(key);
      t("common.actions.save", "Save");
      t("common.actions.close", { defaultValue: "Close" });
    `,
    "consumer.tsx",
  );

  assert.equal(result.issues.filter((issue) => issue.includes("string literals")).length, 1);
  assert.equal(result.issues.filter((issue) => issue.includes("fallbacks")).length, 2);
});

test("accounts for plural families and reports missing interpolation and unused keys", () => {
  const locales = new Map([
    [
      "en",
      parseLocaleSource(
        `export const en = {
          audio: { options: {
            channels_one: "{{count}} channel",
            channels_other: "{{count}} channels",
          } },
          common: { labels: {
            greeting: "Hello {{name}}",
            unused: "Unused",
          } },
        } as const;`,
        "en",
      ),
    ],
  ]);

  const scanned = scanTranslationSource(
    `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t("audio.options.channels", { count: 2 });
      t("common.labels.greeting");
      t("common.labels.missing");
    `,
    "consumer.tsx",
  );

  const report = validateResourceUsage(locales, scanned.usages);

  assert.ok(
    report.issues.includes("consumer.tsx:6: missing translation key common.labels.missing"),
  );
  assert.ok(
    report.issues.includes(
      "consumer.tsx:5: common.labels.greeting requires interpolation parameter name",
    ),
  );
  assert.ok(report.issues.includes("unused translation key common.labels.unused"));
  assert.ok(!report.issues.some((issue) => issue.includes("audio.options.channels_")));
});

test("reports locale structure and interpolation mismatches", () => {
  const locales = new Map([
    [
      "en",
      parseLocaleSource(
        `export const en = { common: { labels: { greeting: "Hello {{name}}" } } } as const;`,
        "en",
      ),
    ],
    [
      "sk",
      parseLocaleSource(
        `export const sk = { common: { labels: {
          extra: "Navyše",
          greeting: "Ahoj {{person}}",
        } } } as const;`,
        "sk",
      ),
    ],
  ]);

  const issues = validateLocaleArchitecture(locales);

  assert.ok(issues.includes("sk has extra translation key common.labels.extra"));
  assert.ok(issues.includes("sk interpolation parameters differ for common.labels.greeting"));
});
