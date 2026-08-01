import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const previewUrl = "http://127.0.0.1:4173";
const processes = new Set();

function start(args) {
  const child = spawn(command, args, { stdio: "inherit" });
  processes.add(child);
  child.once("exit", () => processes.delete(child));
  return child;
}

function stopAll() {
  for (const child of processes) child.kill();
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetch(previewUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Vite preview did not become available at ${previewUrl}`);
}

process.once("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

const build = start(["build:web"]);
if ((await new Promise((resolve) => build.once("exit", resolve))) !== 0) process.exit(1);

const preview = start([
  "preview:web",
  "--",
  "--host",
  "127.0.0.1",
  "--port",
  "4173",
  "--strictPort",
]);
try {
  await waitForPreview();
} catch (error) {
  console.error(error.message);
  stopAll();
  process.exit(1);
}

const tauri = start([
  "--filter",
  "@easytrim-editor/desktop",
  "tauri",
  "dev",
  "--config",
  JSON.stringify({ build: { devUrl: previewUrl, beforeDevCommand: "" } }),
]);
const exitCode = await new Promise((resolve) => tauri.once("exit", (code) => resolve(code ?? 1)));
stopAll();
process.exit(exitCode);
