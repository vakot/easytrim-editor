import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const sourceRoot = resolve("apps/desktop/src");
const sourceRoots = [sourceRoot, resolve("packages/ui/src")];
const sourceExtensions = new Set([".css", ".scss", ".ts", ".tsx", ".html", ".svg"]);
const violations = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") await visit(path);
      continue;
    }

    if (!sourceExtensions.has(extname(entry.name))) continue;

    const source = await readFile(path, "utf8");
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const values = [...line.matchAll(/(?<![a-zA-Z])\d+(?:\.\d+)?px\b/gi)];
      for (const value of values) {
        // Zero has no physical size; this is a one-pixel segment marker by design.
        if (
          value[0] === "0px" ||
          (value[0] === "1px" &&
            relative(sourceRoot, path).split(sep).join("/") === "styles/layout.css" &&
            line.trim() === "--marker-width: 1px;")
        ) {
          continue;
        }
        violations.push(`${relative(process.cwd(), path)}:${index + 1}: ${value[0]}`);
      }
    }
  }
}

for (const root of sourceRoots) await visit(root);

if (violations.length > 0) {
  console.error("Fixed pixel literals found in frontend source:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Frontend source has no unapproved numeric px literals.");
}
