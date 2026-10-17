import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  developmentEnvironment,
  developmentIdentifier,
  parseDevArguments,
} from "../dev-profile.mjs";

test("normal development persists; fresh accepts pnpm's optional separator", () => {
  assert.deepEqual(parseDevArguments([]), { fresh: false });
  assert.deepEqual(parseDevArguments(["--"]), { fresh: false });
  assert.deepEqual(parseDevArguments(["--fresh"]), { fresh: true });
  assert.deepEqual(parseDevArguments(["--", "--fresh"]), { fresh: true });
  for (const args of [["--config", "production.json"], ["--fresh", "--fresh"], ["unknown"]]) {
    assert.throws(() => parseDevArguments(args), /Usage/);
  }
});

test("fresh selects native memory-only progress without changing the parent environment", () => {
  const env = { PATH: "tools", CUSTOM: "keep", EASYTRIM_EPHEMERAL_PROGRESS: "1" };
  assert.deepEqual(developmentEnvironment(env, true), {
    ...env,
    EASYTRIM_MEDIA_DEBUG: "1",
    EASYTRIM_EPHEMERAL_PROGRESS: "1",
  });
  assert.equal(developmentEnvironment(env, false).EASYTRIM_EPHEMERAL_PROGRESS, "0");
  assert.equal(env.EASYTRIM_EPHEMERAL_PROGRESS, "1");
  assert.equal(env.EASYTRIM_MEDIA_DEBUG, undefined);
});

test("development config isolates the identifier without changing production", async () => {
  const config = async (name) =>
    JSON.parse(
      await readFile(new URL(`../../apps/desktop/src-tauri/${name}`, import.meta.url), "utf8"),
    );

  assert.equal((await config("tauri.dev.conf.json")).identifier, developmentIdentifier);
  assert.equal((await config("tauri.conf.json")).identifier, "com.vakot.easytrimeditor");
});
