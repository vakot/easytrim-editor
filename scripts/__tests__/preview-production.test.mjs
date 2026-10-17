import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("preview builds its own identity and never launches an old executable when the build fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "easytrim-preview-launch-test-"));
  const log = join(directory, "build.json");
  const fixture = join(directory, "pnpm-fixture.cjs");
  await writeFile(
    fixture,
    `
    require("node:fs").writeFileSync(process.env.PREVIEW_TEST_LOG, JSON.stringify({
      args: process.argv.slice(2),
      profile: process.env.EASYTRIM_REPOSITORY_PROFILE,
      fresh: process.env.EASYTRIM_EPHEMERAL_PROGRESS,
      debug: process.env.EASYTRIM_MEDIA_DEBUG,
    }));
    process.exit(17);
  `,
  );
  const command = join(directory, process.platform === "win32" ? "pnpm.cmd" : "pnpm");
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(
    command,
    process.platform === "win32"
      ? `@"${process.execPath}" "${fixture}" %*\r\n`
      : `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} "$@"\n`,
  );
  if (process.platform !== "win32") await chmod(command, 0o755);
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../preview-production.mjs", import.meta.url))],
    {
      env: {
        ...process.env,
        PATH: directory,
        PREVIEW_TEST_LOG: log,
        EASYTRIM_REPOSITORY_PROFILE: "development",
        EASYTRIM_EPHEMERAL_PROGRESS: "1",
        EASYTRIM_MEDIA_DEBUG: "1",
      },
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    },
  );

  assert.equal(result.status, 17, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(log, "utf8")), {
    args: [
      "--filter",
      "@easytrim-editor/desktop",
      "tauri",
      "build",
      "--no-bundle",
      "--config",
      "src-tauri/tauri.preview.conf.json",
    ],
    profile: "preview",
    fresh: "0",
  });
  assert.doesNotMatch(result.stdout, /Launching/);
});
