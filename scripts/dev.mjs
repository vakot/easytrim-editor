import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["--filter", "@easytrim-editor/desktop", "tauri", "dev"], {
  env: { ...process.env, EASYTRIM_MEDIA_DEBUG: "1" },
  stdio: "inherit",
  windowsHide: false,
  shell: process.platform === "win32",
});

child.once("error", (error) => {
  console.error(`dev: failed to launch Tauri: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
