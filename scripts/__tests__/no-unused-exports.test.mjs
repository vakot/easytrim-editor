import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";

import { createNoUnusedExportsPlugin } from "../eslint/no-unused-exports.mjs";

test("reports unused project exports while allowing generic UI exports", async (t) => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), "easytrim-eslint-"));
  const sourceDirectory = path.join(projectDirectory, "src");
  const uiDirectory = path.join(sourceDirectory, "components", "ui");
  await mkdir(uiDirectory, { recursive: true });
  t.after(() => rm(projectDirectory, { force: true, recursive: true }));

  await writeFile(
    path.join(projectDirectory, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { module: "ESNext" }, include: ["src"] }),
  );
  await writeFile(
    path.join(sourceDirectory, "library.ts"),
    [
      "export const usedValue = 1;",
      "export const unusedValue = 2;",
      "export const usedThroughBarrel = 3;",
      "export const unusedThroughBarrel = 4;",
      "export type UnusedType = string;",
    ].join("\n"),
  );
  await writeFile(path.join(sourceDirectory, "barrel.ts"), 'export * from "./library";\n');
  await writeFile(
    path.join(sourceDirectory, "consumer.ts"),
    [
      'import { usedThroughBarrel } from "./barrel";',
      'import { usedValue } from "./library";',
      "void usedThroughBarrel;",
      "void usedValue;",
    ].join("\n"),
  );
  await writeFile(path.join(uiDirectory, "primitive.ts"), "export const GenericPrimitive = 1;\n");

  const projectPlugin = createNoUnusedExportsPlugin({
    ignoredDirectories: [uiDirectory],
    project: path.join(projectDirectory, "tsconfig.json"),
  });
  const eslint = new ESLint({
    cwd: projectDirectory,
    overrideConfig: [
      ...tseslint.configs.recommended,
      {
        files: ["src/**/*.{ts,tsx}"],
        plugins: { project: projectPlugin },
        rules: { "project/no-unused-exports": "error" },
      },
    ],
    overrideConfigFile: true,
  });

  const results = await eslint.lintFiles(["src/**/*.ts"]);
  const unusedNames = results
    .flatMap((result) => result.messages)
    .filter((message) => message.ruleId === "project/no-unused-exports")
    .map((message) => message.message.match(/^'(.+)'/)?.[1]);

  assert.deepEqual([...new Set(unusedNames)].sort(), [
    "UnusedType",
    "unusedThroughBarrel",
    "unusedValue",
  ]);
});
