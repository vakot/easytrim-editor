import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getTranslationUnits,
  parseLocaleSource,
  scanTranslationSource,
  validateI18n,
  validateLocaleArchitecture,
  validateResourceUsage,
  validateShortcutHintLabels,
} from "../i18n-validation.mjs";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("validates the repository translation graph", async () => {
  const report = await validateI18n(repositoryRoot);

  assert.equal(report.localeCount, 2);
  assert.equal(report.resourceLeafCount, report.usedResourceLeafCount);
  assert.equal(report.resourceUnitCount, report.usedResourceUnitCount);
  assert.ok(report.resourceUnitCount < report.resourceLeafCount);
  assert.ok(
    report.translationUnits.some((unit) => unit.key === "queue.summary.jobs" && unit.forms),
  );
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

test("scans translation calls in non-React consumers", () => {
  const result = scanTranslationSource(
    `
      import { t } from "@/i18n/config";
      const message = t("source.drop.emptySelection");
    `,
    "adapter.ts",
  );

  assert.deepEqual(result.issues, []);
  assert.equal(result.usages[0]?.key, "source.drop.emptySelection");
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

test("accepts partial locales but rejects unknown keys and interpolation mismatches", () => {
  const locales = new Map([
    [
      "en",
      parseLocaleSource(
        `export const en = { common: { labels: { greeting: "Hello {{name}}" } } } as const;`,
        "en",
      ),
    ],
    [
      "ru",
      parseLocaleSource(
        `export const ru = { common: { labels: {
          extra: "Navyše",
          greeting: "Привет, {{person}}",
        } } } as const;`,
        "ru",
      ),
    ],
  ]);

  const issues = validateLocaleArchitecture(locales);

  assert.ok(issues.includes("ru has extra translation key common.labels.extra"));
  assert.ok(issues.includes("ru interpolation parameters differ for common.labels.greeting"));
  assert.ok(!issues.some((issue) => issue.includes("is missing translation key")));
});

test("rejects duplicate keys, empty strings, and incomplete canonical plural families", () => {
  const en = parseLocaleSource(
    `export const en = {
      queue: { summary: { jobs_one: "{{count}} job", blank: "  ", blank: "Value" } },
    } as const;`,
    "en",
  );

  assert.ok(
    en.issues.some((issue) => issue.includes("duplicate translation key queue.summary.blank")),
  );
  assert.ok(
    en.issues.some((issue) => issue.includes("empty translation value at queue.summary.blank")),
  );
  assert.ok(
    validateLocaleArchitecture(new Map([["en", en]])).includes(
      "canonical plural family queue.summary.jobs requires an _other form",
    ),
  );
});

function pluralLocales(
  language,
  translatedForms = {},
  canonicalForms = {
    jobs_one: "{{count}} job",
    jobs_other: "{{count}} jobs",
  },
) {
  return new Map([
    [
      "en",
      parseLocaleSource(
        `export const en = { queue: { summary: ${JSON.stringify(canonicalForms)} } } as const;`,
        "en",
      ),
    ],
    [
      language,
      parseLocaleSource(
        `export const ${language} = { queue: { summary: ${JSON.stringify(translatedForms)} } } as const;`,
        language,
      ),
    ],
  ]);
}

test("groups plural leaves into one translation unit", () => {
  const en = pluralLocales("ru").get("en");
  const units = getTranslationUnits(en.leaves);

  assert.equal(units.size, 1);
  assert.deepEqual([...units.get("queue.summary.jobs").forms.keys()], ["one", "other"]);
});

test("accepts a wholly untranslated plural family", () => {
  const en = parseLocaleSource(
    `export const en = { queue: {
      title: "Queue",
      summary: { jobs_one: "{{count}} job", jobs_other: "{{count}} jobs" },
    } } as const;`,
    "en",
  );

  const ru = parseLocaleSource(`export const ru = { queue: { title: "Очередь" } } as const;`, "ru");
  const locales = new Map([
    ["en", en],
    ["ru", ru],
  ]);

  assert.deepEqual(ru.issues, []);
  assert.deepEqual(validateLocaleArchitecture(locales), []);
});

test("accepts complete locale-specific cardinal forms absent from English", () => {
  const forms = {
    jobs_one: "{{count}} job",
    jobs_few: "{{count}} jobs",
    jobs_many: "{{count}} jobs",
    jobs_other: "{{count}} jobs",
  };

  assert.deepEqual(validateLocaleArchitecture(pluralLocales("ru", forms)), []);
});

test("rejects partially translated plural families", () => {
  const oneOnly = pluralLocales("ru", { jobs_one: "{{count}} job" });
  const issues = validateLocaleArchitecture(oneOnly);

  for (const category of ["few", "many", "other"]) {
    assert.ok(issues.includes(`ru plural family queue.summary.jobs requires an _${category} form`));
  }
  const missingMany = pluralLocales("ru", {
    jobs_one: "{{count}} job",
    jobs_few: "{{count}} jobs",
    jobs_other: "{{count}} jobs",
  });

  assert.ok(
    validateLocaleArchitecture(missingMany).includes(
      "ru plural family queue.summary.jobs requires an _many form",
    ),
  );
});

test("rejects unsupported plural forms and ordinary unknown keys", () => {
  const locales = pluralLocales("ru", {
    jobs_one: "{{count}} job",
    jobs_few: "{{count}} jobs",
    jobs_many: "{{count}} jobs",
    jobs_other: "{{count}} jobs",
    jobs_two: "{{count}} jobs",
    jobs_bogus: "{{count}} jobs",
    foo: "Unexpected",
  });

  const issues = validateLocaleArchitecture(locales);

  assert.ok(issues.includes("ru has unsupported plural form queue.summary.jobs_two"));
  assert.ok(issues.includes("ru has extra translation key queue.summary.jobs_bogus"));
  assert.ok(issues.includes("ru has extra translation key queue.summary.foo"));
});

test("checks interpolation in locale-specific plural forms", () => {
  const locales = pluralLocales("ru", {
    jobs_one: "{{count}} job",
    jobs_few: "{{total}} jobs",
    jobs_many: "{{count}} jobs",
    jobs_other: "{{count}} jobs",
  });

  assert.ok(
    validateLocaleArchitecture(locales).includes(
      "ru interpolation parameters differ for queue.summary.jobs_few",
    ),
  );
});

test("requires explicit zero consistently when English defines one", () => {
  const canonical = {
    jobs_zero: "{{count}} jobs ready",
    jobs_one: "{{count}} job",
    jobs_other: "{{count}} jobs",
  };

  const complete = {
    jobs_zero: "{{count}} jobs ready",
    jobs_one: "{{count}} job",
    jobs_few: "{{count}} jobs",
    jobs_many: "{{count}} jobs",
    jobs_other: "{{count}} jobs",
  };

  assert.deepEqual(validateLocaleArchitecture(pluralLocales("ru", complete, canonical)), []);
  delete complete.jobs_zero;
  assert.ok(
    validateLocaleArchitecture(pluralLocales("ru", complete, canonical)).includes(
      "ru plural family queue.summary.jobs requires an _zero form",
    ),
  );
  assert.ok(
    validateLocaleArchitecture(
      pluralLocales("ru", { ...complete, jobs_zero: "{{count}} jobs ready" }),
    ).includes("ru has unsupported plural form queue.summary.jobs_zero"),
  );
});

test("enforces measured shortcut hint label limits for each locale and row", () => {
  const locales = new Map([
    [
      "en",
      parseLocaleSource(
        `export const en = {
          source: { file: { openFile: "Open File", openFolder: "Open Folder" } },
          commands: { title: "Command Palette" },
          preview: { shortcuts: {
            playPause: "Play / Pause",
            previousNextFrame: "Prev / Next Frame",
            markInOut: "Mark In / Mark Out",
          } },
        } as const;`,
        "en",
      ),
    ],
    [
      "ru",
      parseLocaleSource(
        `export const ru = {
          source: { file: { openFile: "Открыть файл", openFolder: "Открыть папку" } },
          commands: { title: "Палитра команд" },
          preview: { shortcuts: {
            playPause: "Пуск / Пауза",
            previousNextFrame: "Предыдущий / Следующий кадр",
            markInOut: "Начало / Конец",
          } },
        } as const;`,
        "ru",
      ),
    ],
  ]);

  const issues = validateShortcutHintLabels(locales);
  assert.equal(issues.length, 1);
  assert.match(
    issues[0],
    /ru: preview\.shortcuts\.previousNextFrame for the Previous \/ Next Frame hint row must not exceed 22 symbols/,
  );
});
