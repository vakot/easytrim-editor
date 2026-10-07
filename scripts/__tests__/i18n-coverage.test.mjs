import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { generateTranslationCoverage } from "../generate-i18n-coverage.mjs";
import {
  getTranslationCoverage,
  parseLocaleSource,
  validateI18n,
  validateLocaleArchitecture,
} from "../i18n-validation.mjs";
import { formatCoverage, parseArguments } from "../validate-i18n.mjs";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function coverageFor(canonical, locales) {
  const resources = new Map([
    ["en", parseLocaleSource(canonical, "en")],
    ...Object.entries(locales).map(([locale, source]) => [
      locale,
      parseLocaleSource(source, locale),
    ]),
  ]);

  assert.deepEqual(validateLocaleArchitecture(resources), []);
  return getTranslationCoverage(resources);
}

function runCli(...args) {
  return spawnSync(process.execPath, ["scripts/validate-i18n.mjs", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

test("counts ordinary leaves and plural families as semantic translation units", () => {
  const coverage = coverageFor(
    `export const en = {
      queue: { items_one: "{{count}} item", items_other: "{{count}} items" },
      settings: { theme: "Theme", language: "Language" },
    } as const;`,
    {
      ru: `export const ru = {
        queue: {
          items_one: "{{count}} предмет",
          items_few: "{{count}} предмета",
          items_many: "{{count}} предметов",
          items_other: "{{count}} предмета",
        },
        settings: { theme: "Тема" },
      } as const;`,
      sk: `export const sk = {
        queue: {
          items_one: "{{count}} položka",
          items_few: "{{count}} položky",
          items_many: "{{count}} položiek",
          items_other: "{{count}} položiek",
        },
        settings: { theme: "Téma" },
      } as const;`,
    },
  );

  const russian = coverage.find((entry) => entry.locale === "ru");
  const slovak = coverage.find((entry) => entry.locale === "sk");
  assert.deepEqual(russian, {
    locale: "ru",
    translatedUnits: 2,
    totalUnits: 3,
    percentage: 67,
    missingUnits: ["settings.language"],
  });
  assert.deepEqual(slovak, {
    locale: "sk",
    translatedUnits: 2,
    totalUnits: 3,
    percentage: 67,
    missingUnits: ["settings.language"],
  });
  assert.equal(coverage.find((entry) => entry.locale === "en")?.percentage, 100);
});

test("counts a completely missing plural family as one missing unit", () => {
  const coverage = coverageFor(
    `export const en = {
      queue: { jobs_one: "{{count}} job", jobs_other: "{{count}} jobs" },
      common: { save: "Save" },
    } as const;`,
    {
      ru: `export const ru = { common: { save: "Сохранить" } } as const;`,
    },
  );

  const russian = coverage.find((entry) => entry.locale === "ru");
  assert.equal(russian?.translatedUnits, 1);
  assert.equal(russian?.totalUnits, 2);
  assert.deepEqual(russian?.missingUnits, ["queue.jobs"]);
});

test("uses deterministic integer rounding for percentage coverage", () => {
  const coverage = coverageFor(
    `export const en = { settings: {
      a: "A", b: "B", c: "C", d: "D", e: "E", f: "F", g: "G", h: "H",
    } } as const;`,
    { ru: `export const ru = { settings: { a: "А" } } as const;` },
  );

  assert.equal(coverage.find((entry) => entry.locale === "ru")?.percentage, 13);
});

test("includes the structured AppError catalog in canonical coverage", async () => {
  const report = await validateI18n(repositoryRoot);
  const diagnostics = "app.errors.diagnostics.diagnosticEventNameIsInvalid";

  assert.ok(report.translationUnits.some((unit) => unit.key === diagnostics));
  assert.ok(
    report.coverage.find((entry) => entry.locale === "ru")?.missingUnits.includes(diagnostics),
  );
});

test("formats concise and verbose summaries with optional detail filtering", () => {
  const coverage = [
    { locale: "en", translatedUnits: 8, totalUnits: 8, percentage: 100, missingUnits: [] },
    {
      locale: "ru",
      translatedUnits: 1,
      totalUnits: 8,
      percentage: 13,
      missingUnits: ["queue.items", "app.errors.example"],
    },
    {
      locale: "sk",
      translatedUnits: 2,
      totalUnits: 8,
      percentage: 25,
      missingUnits: ["settings.about"],
    },
  ];

  assert.equal(
    formatCoverage(coverage, parseArguments([])),
    "Translations:\nEnglish     100%\nRussian      13%\nSlovak       25%",
  );
  const verbose = formatCoverage(coverage, parseArguments(["--verbose"]));
  assert.match(verbose, /English\s+100%\s+8\/8/);
  assert.match(verbose, /ru:\n {2}app\.errors\.example\n {2}queue\.items/);
  assert.match(verbose, /sk:\n {2}settings\.about/);
  assert.equal(
    formatCoverage(coverage, parseArguments(["--verbose", "ru"]))
      .split("Missing translation units:")[1]
      .includes("sk:"),
    false,
  );
  assert.match(formatCoverage(coverage, parseArguments(["--verbose", "en"])), /English\s+100%/);
  assert.doesNotMatch(
    formatCoverage(coverage, parseArguments(["--verbose", "en"])),
    /Missing translation units:/,
  );
});

test("rejects locale-only filters and unsupported locales", () => {
  assert.throws(() => parseArguments(["ru"]), /requires --verbose/);
  assert.throws(() => parseArguments(["--verbose", "de"]), /Unsupported locale: de/);
  assert.throws(() => parseArguments(["--verbose", "de"]), /Supported locales: en, ru, sk/);
});

test("CLI prints concise coverage by default and verbose details when requested", () => {
  const concise = runCli();
  assert.equal(concise.status, 0, concise.stderr);
  assert.match(concise.stdout, /^Translations:\nEnglish\s+100%\nRussian\s+\d+%\nSlovak\s+\d+%\n$/);
  assert.doesNotMatch(concise.stdout, /validation passed|errors|keys checked/i);

  const verbose = runCli("--verbose");
  assert.equal(verbose.status, 0, verbose.stderr);
  assert.match(verbose.stdout, /Missing translation units:/);
  assert.match(verbose.stdout, /ru:\n/);
  assert.match(verbose.stdout, /sk:\n/);
  assert.doesNotMatch(verbose.stdout, /queue\.summary\.jobs_(one|few|many|other)/);
  const russianMissing = verbose.stdout.split("ru:\n")[1].split("\nsk:\n")[0];
  assert.equal((russianMissing.match(/queue\.summary\.jobs/g) ?? []).length, 1);

  const filtered = runCli("--verbose", "ru");
  assert.equal(filtered.status, 0, filtered.stderr);
  assert.match(filtered.stdout, /English\s+100%/);
  assert.match(filtered.stdout, /Russian\s+\d+%/);
  assert.match(filtered.stdout, /Slovak\s+\d+%/);
  assert.match(filtered.stdout, /Missing translation units:\nru:\n/);
  assert.doesNotMatch(filtered.stdout, /\nsk:\n/);
  const missingUnits = filtered.stdout
    .split("Missing translation units:\nru:\n")[1]
    .trim()
    .split("\n")
    .map((line) => line.trim());

  assert.deepEqual(missingUnits, [...missingUnits].sort());

  const english = runCli("--verbose", "en");
  assert.equal(english.status, 0, english.stderr);
  assert.match(english.stdout, /English\s+100%\s+\d+\/\d+/);
  assert.doesNotMatch(english.stdout, /Missing translation units:/);
});

test("CLI rejects locale-only filters and unknown verbose locales", () => {
  const localeOnly = runCli("ru");
  assert.notEqual(localeOnly.status, 0);
  assert.match(localeOnly.stderr, /requires --verbose/);

  const unknownLocale = runCli("--verbose", "de");
  assert.notEqual(unknownLocale.status, 0);
  assert.match(unknownLocale.stderr, /Unsupported locale: de/);
  assert.match(unknownLocale.stderr, /Supported locales: en, ru, sk/);
});

test("generates compact serializable metadata from validated coverage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "easytrim-i18n-coverage-"));
  const destination = join(directory, "coverage.generated.ts");

  try {
    assert.equal(await generateTranslationCoverage(repositoryRoot, destination), true);
    const generated = await readFile(destination, "utf8");
    const executable = generated
      .replace("export const", "const")
      .replace(" as const;", ";\ntranslationCoverage;");

    const coverage = runInNewContext(executable);

    assert.deepEqual(Object.keys(coverage), ["en", "ru", "sk"]);
    assert.deepEqual(Object.keys(coverage.en), ["translatedUnits", "totalUnits", "percentage"]);
    assert.equal(coverage.en.percentage, 100);
    assert.doesNotThrow(() => JSON.stringify(coverage));
    assert.equal(await generateTranslationCoverage(repositoryRoot, destination), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
