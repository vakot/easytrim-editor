import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

import ts from "typescript";

const CANONICAL_LOCALE = "en";
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];
const PLURAL_KEY = /^(.*)_(zero|one|two|few|many|other)$/;
const SUSPICIOUS_CYRILLIC = /[\u0400-\u04ff]/;
const SUSPICIOUS_MOJIBAKE = /[\ufffd]|Ã|Â/;

// The hint list is at most 18rem (288px): reserve 24px for row gaps, 16px for
// the dotted divider, and up to 68px for keycaps; the remaining 180px allows
// 22 code points at about 8px each. Space uses fewer pixels, so allow 24 there.
const SHORTCUT_HINT_LABEL_LIMITS = [
  { key: "source.file.openFile", maxSymbols: 22, row: "Open File" },
  { key: "source.file.openFolder", maxSymbols: 22, row: "Open Folder" },
  { key: "preview.shortcuts.playPause", maxSymbols: 24, row: "Play / Pause" },
  {
    key: "preview.shortcuts.previousNextFrame",
    maxSymbols: 22,
    row: "Previous / Next Frame",
  },
  { key: "preview.shortcuts.markInOut", maxSymbols: 22, row: "Mark In / Mark Out" },
  { key: "commands.title", maxSymbols: 22, row: "Command Palette" },
];

export async function validateI18n(repositoryRoot) {
  const report = await auditI18n(repositoryRoot);
  if (report.issues.length > 0) {
    throw new Error(
      `i18n validation failed:\n${report.issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
  }
  return report;
}

export async function auditI18n(repositoryRoot) {
  const desktopSource = join(repositoryRoot, "apps", "desktop", "src");
  const localeDirectory = join(desktopSource, "i18n", "locales");
  const localePaths = (await readdir(localeDirectory))
    .filter((name) => extname(name) === ".ts")
    .map((name) => join(localeDirectory, name));

  const sourcePaths = await collectTypeScriptFiles(desktopSource);
  const locales = new Map();
  const usages = [];
  const issues = [];

  for (const localePath of localePaths) {
    const localeName = basename(localePath, ".ts");
    const sourceText = await readFile(localePath, "utf8");
    const parsed = parseLocaleSource(sourceText, localeName, relative(repositoryRoot, localePath));
    locales.set(localeName, parsed);
    issues.push(...parsed.issues);
  }

  for (const sourcePath of sourcePaths) {
    if (sourcePath.startsWith(localeDirectory)) continue;
    const sourceText = await readFile(sourcePath, "utf8");
    const parsed = scanTranslationSource(sourceText, relative(repositoryRoot, sourcePath));
    usages.push(...parsed.usages);
    issues.push(...parsed.issues);
  }

  issues.push(...validateLocaleArchitecture(locales));
  issues.push(...validateShortcutHintLabels(locales));
  const usageReport = validateResourceUsage(locales, usages);
  issues.push(...usageReport.issues);
  const units = getTranslationUnits(locales.get(CANONICAL_LOCALE)?.leaves ?? new Map());

  return {
    issues,
    localeCount: locales.size,
    resourceLeafCount: locales.get(CANONICAL_LOCALE)?.leaves.size ?? 0,
    usedResourceLeafCount: usageReport.usedResourceLeafCount,
    resourceUnitCount: units.size,
    usedResourceUnitCount: usageReport.usedResourceUnitCount,
    translationUnits: [...units.values()],
  };
}

// A plural family is one translation unit even when it has several resource leaves.
export function getTranslationUnits(leaves) {
  const families = new Map();
  for (const key of leaves.keys()) {
    const match = key.match(PLURAL_KEY);
    if (!match) continue;
    const forms = families.get(match[1]) ?? new Map();
    forms.set(match[2], key);
    families.set(match[1], forms);
  }

  const units = new Map();
  for (const key of leaves.keys()) {
    const match = key.match(PLURAL_KEY);
    if (match) {
      if (!units.has(match[1])) {
        units.set(match[1], { key: match[1], forms: families.get(match[1]) });
      }
    } else if (!families.has(key)) {
      units.set(key, { key, forms: null });
    }
  }
  return units;
}

export function validateShortcutHintLabels(locales) {
  const issues = [];

  for (const [localeName, locale] of locales) {
    for (const { key, maxSymbols, row } of SHORTCUT_HINT_LABEL_LIMITS) {
      const label = locale.leaves.get(key);
      if (label === undefined) continue;

      const symbolCount = Array.from(label).length;
      if (symbolCount > maxSymbols) {
        issues.push(
          `${localeName}: ${key} for the ${row} hint row must not exceed ${maxSymbols} symbols (found ${symbolCount})`,
        );
      }
    }
  }

  return issues;
}

export function parseLocaleSource(sourceText, localeName, fileName = `${localeName}.ts`) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const issues = [];
  const leaves = new Map();
  const objectChildren = new Map();
  let initializer;

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === localeName) {
        initializer = declaration.initializer;
      }
    }
  }

  if (!initializer) {
    issues.push(`${fileName}: expected an exported ${localeName} locale object`);
    return { issues, leaves, objectChildren };
  }

  visitLocaleNode(unwrapExpression(initializer), []);
  return { issues, leaves, objectChildren };

  function visitLocaleNode(node, path) {
    const unwrapped = unwrapExpression(node);
    if (ts.isStringLiteralLike(unwrapped)) {
      const key = path.join(".");
      if (leaves.has(key)) issues.push(`${fileName}: duplicate translation key ${key}`);
      if (!unwrapped.text.trim()) issues.push(`${fileName}: empty translation value at ${key}`);
      if (
        SUSPICIOUS_MOJIBAKE.test(unwrapped.text) ||
        (localeName !== "ru" && SUSPICIOUS_CYRILLIC.test(unwrapped.text))
      ) {
        issues.push(`${fileName}: suspicious text encoding in ${key}`);
      }
      leaves.set(key, unwrapped.text);
      return;
    }

    if (!ts.isObjectLiteralExpression(unwrapped)) {
      issues.push(`${fileName}: ${path.join(".") || "locale root"} must be an object or string`);
      return;
    }

    const childNames = [];
    objectChildren.set(path.join("."), childNames);
    for (const property of unwrapped.properties) {
      if (!ts.isPropertyAssignment(property)) {
        issues.push(`${fileName}: ${path.join(".") || "locale root"} uses a non-static property`);
        continue;
      }
      const name = staticPropertyName(property.name);
      if (!name) {
        issues.push(`${fileName}: ${path.join(".") || "locale root"} uses a computed property`);
        continue;
      }
      if (childNames.includes(name)) {
        issues.push(`${fileName}: duplicate translation key ${[...path, name].join(".")}`);
      }
      childNames.push(name);
      visitLocaleNode(property.initializer, [...path, name]);
    }

    if (childNames.length === 0) {
      issues.push(`${fileName}: empty translation object at ${path.join(".") || "locale root"}`);
    }
  }
}

export function scanTranslationSource(sourceText, fileName = "source.ts") {
  const scriptKind = fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const issues = [];
  const usages = [];
  const isTranslationConsumer = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      (statement.moduleSpecifier.text === "i18next" ||
        statement.moduleSpecifier.text === "react-i18next"),
  );

  if (!isTranslationConsumer) return { issues, usages };
  visit(sourceFile);
  return { issues, usages };

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t"
    ) {
      const argument = node.arguments[0];
      const location = sourceLocation(sourceFile, argument ?? node);
      if (!argument || !ts.isStringLiteralLike(argument)) {
        issues.push(`${fileName}:${location}: translation keys must be string literals`);
      } else {
        const options = node.arguments[1];
        if (options && ts.isStringLiteralLike(options)) {
          issues.push(`${fileName}:${location}: inline translation fallbacks are not allowed`);
        }
        const optionKeys = readOptionKeys(options, fileName, location, issues);
        if (optionKeys?.has("defaultValue")) {
          issues.push(`${fileName}:${location}: inline translation fallbacks are not allowed`);
        }
        usages.push({ fileName, key: argument.text, line: location, optionKeys });
      }
    }
    ts.forEachChild(node, visit);
  }
}

export function validateResourceUsage(locales, usages) {
  const issues = [];
  const canonical = locales.get(CANONICAL_LOCALE);
  const usedLeaves = new Set();

  if (!canonical) {
    return {
      issues: [`missing canonical ${CANONICAL_LOCALE} locale`],
      usedResourceLeafCount: 0,
      usedResourceUnitCount: 0,
    };
  }

  for (const usage of usages) {
    const matchingLeaves = canonical.leaves.has(usage.key)
      ? [usage.key]
      : PLURAL_SUFFIXES.map((suffix) => `${usage.key}_${suffix}`).filter((key) =>
          canonical.leaves.has(key),
        );

    if (matchingLeaves.length === 0) {
      issues.push(`${usage.fileName}:${usage.line}: missing translation key ${usage.key}`);
      continue;
    }

    const expectedParameters = new Set();
    for (const key of matchingLeaves) {
      usedLeaves.add(key);
      for (const parameter of interpolationParameters(canonical.leaves.get(key))) {
        expectedParameters.add(parameter);
      }
    }

    for (const parameter of expectedParameters) {
      if (!usage.optionKeys?.has(parameter)) {
        issues.push(
          `${usage.fileName}:${usage.line}: ${usage.key} requires interpolation parameter ${parameter}`,
        );
      }
    }
  }

  for (const key of canonical.leaves.keys()) {
    if (!usedLeaves.has(key)) issues.push(`unused translation key ${key}`);
  }

  const units = getTranslationUnits(canonical.leaves);
  const usedResourceUnitCount = [...units.values()].filter((unit) =>
    unit.forms
      ? [...unit.forms.values()].some((key) => usedLeaves.has(key))
      : usedLeaves.has(unit.key),
  ).length;

  return { issues, usedResourceLeafCount: usedLeaves.size, usedResourceUnitCount };
}

export function validateLocaleArchitecture(locales) {
  const issues = [];
  const canonical = locales.get(CANONICAL_LOCALE);
  if (!canonical) return [`missing canonical ${CANONICAL_LOCALE} locale`];
  const units = getTranslationUnits(canonical.leaves);
  const families = [...units.values()].filter((unit) => unit.forms);
  const canonicalCategories = pluralCategories(CANONICAL_LOCALE);
  for (const { forms, key } of families) {
    const required = requiredPluralForms(canonicalCategories, forms);
    for (const category of required) {
      if (!forms.has(category)) {
        issues.push(`canonical plural family ${key} requires an _${category} form`);
      }
    }
    for (const category of forms.keys()) {
      if (!required.has(category)) {
        issues.push(`canonical plural family ${key} has unsupported _${category} form`);
      }
    }
    if (canonical.leaves.has(key)) {
      issues.push(`canonical plural family ${key} conflicts with an unsuffixed key`);
    }
    const expected = familyParameters(canonical.leaves, forms);
    for (const formKey of forms.values()) {
      if (!sameParameters(expected, interpolationParameters(canonical.leaves.get(formKey)))) {
        issues.push(`canonical interpolation parameters differ for ${formKey}`);
      }
    }
  }

  for (const [localeName, locale] of locales) {
    if (localeName === CANONICAL_LOCALE) continue;
    const categories = pluralCategories(localeName);
    for (const key of locale.leaves.keys()) {
      const match = key.match(PLURAL_KEY);
      const unit = match && units.get(match[1]);
      if (unit?.forms) {
        const allowed = requiredPluralForms(categories, unit.forms);
        if (!allowed.has(match[2])) {
          issues.push(`${localeName} has unsupported plural form ${key}`);
        }
      } else if (!canonical.leaves.has(key)) {
        issues.push(`${localeName} has extra translation key ${key}`);
      }
    }
    for (const unit of units.values()) {
      if (!unit.forms) {
        const value = locale.leaves.get(unit.key);
        if (
          value !== undefined &&
          !sameParameters(
            interpolationParameters(canonical.leaves.get(unit.key)),
            interpolationParameters(value),
          )
        ) {
          issues.push(`${localeName} interpolation parameters differ for ${unit.key}`);
        }
        continue;
      }
      const localizedForms = [...locale.leaves.keys()].filter((key) => {
        const match = key.match(PLURAL_KEY);
        return match?.[1] === unit.key;
      });

      if (localizedForms.length === 0) continue;
      for (const category of requiredPluralForms(categories, unit.forms)) {
        if (!locale.leaves.has(`${unit.key}_${category}`)) {
          issues.push(`${localeName} plural family ${unit.key} requires an _${category} form`);
        }
      }
      const expected = familyParameters(canonical.leaves, unit.forms);
      for (const key of localizedForms) {
        if (!sameParameters(expected, interpolationParameters(locale.leaves.get(key)))) {
          issues.push(`${localeName} interpolation parameters differ for ${key}`);
        }
      }
    }
  }

  return issues;
}

function pluralCategories(localeName) {
  return new Set(
    new Intl.PluralRules(localeName, { type: "cardinal" }).resolvedOptions().pluralCategories,
  );
}

function requiredPluralForms(categories, canonicalForms) {
  const required = new Set(categories);
  // i18next checks an explicit _zero before the locale's cardinal category for count 0.
  if (canonicalForms.has("zero")) required.add("zero");
  return required;
}

function familyParameters(leaves, forms) {
  const reference = forms.get("other") ?? forms.values().next().value;
  return interpolationParameters(leaves.get(reference));
}

function sameParameters(expected, actual) {
  return [...expected].sort().join("\0") === [...actual].sort().join("\0");
}

async function collectTypeScriptFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "test") {
        paths.push(...(await collectTypeScriptFiles(path)));
      }
      continue;
    }
    if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) paths.push(path);
  }
  return paths;
}

function interpolationParameters(value = "") {
  const parameters = new Set();
  for (const match of value.matchAll(/{{\s*([^\s,}]+)(?:\s*,[^}]*)?}}/g)) {
    parameters.add(match[1]);
  }
  return parameters;
}

function readOptionKeys(options, fileName, location, issues) {
  if (!options || ts.isStringLiteralLike(options)) return undefined;
  if (!ts.isObjectLiteralExpression(options)) {
    issues.push(`${fileName}:${location}: translation options must use an object literal`);
    return undefined;
  }

  const keys = new Set();
  for (const property of options.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      keys.add(property.name.text);
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      const name = staticPropertyName(property.name);
      if (name) keys.add(name);
    }
  }
  return keys;
}

function sourceLocation(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function staticPropertyName(name) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}
