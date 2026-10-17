import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  developmentIdentifier,
  parseDevArguments,
  repositoryEnvironment,
} from "./repository-profile.mjs";

const configPath = fileURLToPath(
  new URL("../apps/desktop/src-tauri/tauri.dev.conf.json", import.meta.url),
);

let fresh;

try {
  ({ fresh } = parseDevArguments(process.argv.slice(2)));
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.identifier !== developmentIdentifier) {
    throw new Error("Development Tauri configuration must use the development identifier");
  }
  if (fresh) {
    console.log("dev: achievement and statistics progress will stay in memory for this session");
  }
} catch (error) {
  console.error(`dev: ${error.message}`);
  process.exit(1);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(
  command,
  [
    "--filter",
    "@easytrim-editor/desktop",
    "tauri",
    "dev",
    "--config",
    "src-tauri/tauri.dev.conf.json",
  ],
  {
    env: repositoryEnvironment(process.env, "development", fresh),
    stdio: "inherit",
    windowsHide: false,
    shell: process.platform === "win32",
  },
);

child.once("error", (error) => {
  console.error(`dev: failed to launch Tauri: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
