import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

import ts from "typescript";

const CANONICAL_LOCALE = "en";
const CANONICAL_NAMESPACES = [
  "common",
  "app",
  "settings",
  "queue",
  "source",
  "preview",
  "timeline",
  "audio",
  "export",
  "support",
  "units",
];

const CATEGORY_ORDER = [
  "actions",
  "labels",
  "status",
  "messages",
  "tooltips",
  "dialogs",
  "accessibility",
  "options",
];

const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];
const SUSPICIOUS_MOJIBAKE = /[\u0400-\u04ff\ufffd]|Ã|Â/;

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
  const usageReport = validateResourceUsage(locales, usages);
  issues.push(...usageReport.issues);

  return {
    issues,
    localeCount: locales.size,
    resourceLeafCount: locales.get(CANONICAL_LOCALE)?.leaves.size ?? 0,
    usedResourceLeafCount: usageReport.usedResourceLeafCount,
  };
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
      if (SUSPICIOUS_MOJIBAKE.test(unwrapped.text)) {
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
    return { issues: [`missing canonical ${CANONICAL_LOCALE} locale`], usedResourceLeafCount: 0 };
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

  return { issues, usedResourceLeafCount: usedLeaves.size };
}

export function validateLocaleArchitecture(locales) {
  const issues = [];
  const canonical = locales.get(CANONICAL_LOCALE);
  if (!canonical) return [`missing canonical ${CANONICAL_LOCALE} locale`];

  const rootChildren = canonical.objectChildren.get("") ?? [];
  if (rootChildren.join("\0") !== CANONICAL_NAMESPACES.join("\0")) {
    issues.push(`canonical namespaces must be ordered as ${CANONICAL_NAMESPACES.join(", ")}`);
  }

  for (const namespace of rootChildren) {
    const categories = canonical.objectChildren.get(namespace) ?? [];
    const unknownCategories = categories.filter((category) => !CATEGORY_ORDER.includes(category));
    if (unknownCategories.length > 0) {
      issues.push(`${namespace} uses unsupported categories: ${unknownCategories.join(", ")}`);
    }
    const categoryIndexes = categories.map((category) => CATEGORY_ORDER.indexOf(category));
    if (
      categoryIndexes.some(
        (index, position) => position > 0 && index < categoryIndexes[position - 1],
      )
    ) {
      issues.push(`${namespace} categories must follow ${CATEGORY_ORDER.join(", ")}`);
    }
  }

  for (const [localeName, locale] of locales) {
    if (localeName === CANONICAL_LOCALE) continue;
    for (const key of canonical.leaves.keys()) {
      if (!locale.leaves.has(key)) issues.push(`${localeName} is missing translation key ${key}`);
    }
    for (const key of locale.leaves.keys()) {
      if (!canonical.leaves.has(key)) issues.push(`${localeName} has extra translation key ${key}`);
    }
    for (const [key, canonicalValue] of canonical.leaves) {
      const localeValue = locale.leaves.get(key);
      if (localeValue === undefined) continue;
      const canonicalParameters = interpolationParameters(canonicalValue);
      const localeParameters = interpolationParameters(localeValue);
      if ([...canonicalParameters].sort().join("\0") !== [...localeParameters].sort().join("\0")) {
        issues.push(`${localeName} interpolation parameters differ for ${key}`);
      }
    }
  }

  return issues;
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
