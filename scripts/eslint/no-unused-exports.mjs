import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

export function createNoUnusedExportsPlugin({ ignoredDirectories = [], project }) {
  const projectPath = path.resolve(project);
  const ignoredPaths = ignoredDirectories.map((directory) =>
    canonicalPath(path.resolve(directory)),
  );
  let cachedAnalysis;
  let cachedSignature;

  const rule = {
    meta: {
      docs: {
        description: "Disallow exports that have no consumers elsewhere in the TypeScript project.",
      },
      messages: {
        unusedExport: "'{{name}}' is exported but never imported by another module.",
      },
      schema: [],
      type: "problem",
    },
    create(context) {
      const filename = path.resolve(context.physicalFilename ?? context.filename);

      return {
        Program() {
          if (isIgnored(filename, ignoredPaths)) return;

          const findings = analyzeProject(
            projectPath,
            ignoredPaths,
            filename,
            context.sourceCode.text,
          );

          for (const finding of findings.get(canonicalPath(filename)) ?? []) {
            context.report({
              data: { name: finding.name },
              loc: finding.loc,
              messageId: "unusedExport",
            });
          }
        },
      };
    },
  };

  function analyzeProject(configPath, ignored, currentFilename, currentSource) {
    const projectConfig = readProjectConfig(configPath);
    const diskSource = ts.sys.readFile(currentFilename);
    const sourceOverride = diskSource === currentSource ? undefined : currentSource;
    const signature = createProjectSignature(
      configPath,
      projectConfig.fileNames,
      currentFilename,
      sourceOverride,
    );

    if (signature === cachedSignature && cachedAnalysis) return cachedAnalysis;

    cachedAnalysis = findUnusedExports(projectConfig, ignored, currentFilename, sourceOverride);
    cachedSignature = signature;
    return cachedAnalysis;
  }

  return {
    meta: {
      name: "easytrim-project-rules",
      version: "1.0.0",
    },
    rules: {
      "no-unused-exports": rule,
    },
  };
}

function readProjectConfig(projectPath) {
  const configFile = ts.readConfigFile(projectPath, ts.sys.readFile);
  if (configFile.error) throw new Error(formatDiagnostic(configFile.error));

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(projectPath),
    { noEmit: true },
    projectPath,
  );

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(formatDiagnostic).join("\n"));
  }

  return parsed;
}

function createProjectSignature(projectPath, fileNames, currentFilename, sourceOverride) {
  const paths = [projectPath, ...fileNames].sort();
  const fileSignature = paths
    .map((filename) => {
      const stats = fs.statSync(filename);
      return `${canonicalPath(filename)}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");

  return sourceOverride === undefined
    ? fileSignature
    : `${fileSignature}|${canonicalPath(currentFilename)}:${hashText(sourceOverride)}`;
}

function findUnusedExports(projectConfig, ignoredPaths, currentFilename, sourceOverride) {
  const compilerHost = ts.createCompilerHost(projectConfig.options);
  const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
  const currentPath = canonicalPath(currentFilename);

  compilerHost.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (sourceOverride !== undefined && canonicalPath(filename) === currentPath) {
      return ts.createSourceFile(
        filename,
        sourceOverride,
        languageVersion,
        true,
        sourceKind(filename),
      );
    }

    return originalGetSourceFile(filename, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const program = ts.createProgram({
    host: compilerHost,
    options: projectConfig.options,
    rootNames: projectConfig.fileNames,
  });
  const checker = program.getTypeChecker();
  const usedExports = collectUsedExports(program, checker);
  const findings = new Map();

  for (const sourceFile of program.getSourceFiles()) {
    if (
      sourceFile.isDeclarationFile ||
      !SOURCE_EXTENSIONS.includes(path.extname(sourceFile.fileName)) ||
      isIgnored(sourceFile.fileName, ignoredPaths)
    ) {
      continue;
    }

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;

    const unused = [];
    for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
      if (usedExports.has(exportedSymbol)) continue;

      const declaration = exportedSymbol
        .getDeclarations()
        ?.find((candidate) => candidate.getSourceFile() === sourceFile);
      if (!declaration) continue;

      const locationNode = declaration.name ?? declaration;
      const start = sourceFile.getLineAndCharacterOfPosition(locationNode.getStart(sourceFile));
      const end = sourceFile.getLineAndCharacterOfPosition(locationNode.getEnd());

      unused.push({
        loc: {
          end: { column: end.character, line: end.line + 1 },
          start: { column: start.character, line: start.line + 1 },
        },
        name: exportedSymbol.getName(),
      });
    }

    if (unused.length > 0) findings.set(canonicalPath(sourceFile.fileName), unused);
  }

  return findings;
}

function collectUsedExports(program, checker) {
  const usedExports = new Set();

  const markExport = (exportedSymbol) => {
    if (usedExports.has(exportedSymbol)) return;
    usedExports.add(exportedSymbol);

    if ((exportedSymbol.flags & ts.SymbolFlags.Alias) !== 0) {
      const aliasedSymbol = checker.getAliasedSymbol(exportedSymbol);
      if (aliasedSymbol !== exportedSymbol) markExport(aliasedSymbol);
    }
  };

  const markAllExports = (moduleSymbol) => {
    for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
      markExport(exportedSymbol);
    }
  };

  const markNamedExport = (moduleSymbol, name) => {
    const exportedSymbol = checker
      .getExportsOfModule(moduleSymbol)
      .find((candidate) => candidate.getName() === name);
    if (exportedSymbol) markExport(exportedSymbol);
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const moduleSymbol = checker.getSymbolAtLocation(node.moduleSpecifier);
      if (moduleSymbol) {
        if (node.importClause.name) markNamedExport(moduleSymbol, "default");

        const bindings = node.importClause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          markAllExports(moduleSymbol);
        } else if (bindings) {
          for (const element of bindings.elements) {
            markNamedExport(moduleSymbol, (element.propertyName ?? element.name).text);
          }
        }
      }
    } else if (ts.isImportTypeNode(node)) {
      const moduleSymbol = checker.getSymbolAtLocation(node.argument.literal);
      if (moduleSymbol) {
        const qualifier = leftmostIdentifier(node.qualifier);
        if (qualifier) markNamedExport(moduleSymbol, qualifier.text);
        else markAllExports(moduleSymbol);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const [moduleSpecifier] = node.arguments;
      if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
        const moduleSymbol = checker.getSymbolAtLocation(moduleSpecifier);
        if (moduleSymbol) markAllExports(moduleSymbol);
      }
    }

    ts.forEachChild(node, visit);
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) visit(sourceFile);
  }

  return usedExports;
}

function leftmostIdentifier(entityName) {
  if (!entityName) return undefined;
  return ts.isIdentifier(entityName) ? entityName : leftmostIdentifier(entityName.left);
}

function isIgnored(filename, ignoredPaths) {
  const filenamePath = canonicalPath(filename);
  return ignoredPaths.some(
    (ignoredPath) =>
      filenamePath === ignoredPath || filenamePath.startsWith(`${ignoredPath}${path.sep}`),
  );
}

function canonicalPath(filename) {
  const normalized = path.normalize(path.resolve(filename));
  return ts.sys.useCaseSensitiveFileNames ? normalized : normalized.toLowerCase();
}

function sourceKind(filename) {
  return path.extname(filename).toLowerCase() === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function formatDiagnostic(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function hashText(value) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
