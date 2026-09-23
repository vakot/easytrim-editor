import assert from "node:assert/strict";
import test from "node:test";

import { parseChangelog } from "../generate-changelog.mjs";

test("parses supported released categories and excludes Unreleased", () => {
  const releases = parseChangelog(
    `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Draft change\n\n## [1.10.3]\n\n### Added\n\n- A feature\n\n### Fixed\n\n- A fix\n`,
  );

  assert.deepEqual(releases, [
    {
      version: "1.10.3",
      sections: [
        { category: "Added", entries: ["A feature"] },
        { category: "Fixed", entries: ["A fix"] },
      ],
    },
  ]);
});

test("sorts releases by semantic version", () => {
  const releases = parseChangelog(
    `# Changelog\n\n## [1.9.0]\n\n### Fixed\n\n- Old\n\n## [1.10.0]\n\n### Fixed\n\n- New\n`,
  );

  assert.deepEqual(
    releases.map((release) => release.version),
    ["1.10.0", "1.9.0"],
  );
});

test("rejects unsupported released structure", () => {
  assert.throws(
    () => parseChangelog(`# Changelog\n\n## [1.0.0]\n\nThis paragraph is not supported.\n`),
    /Unsupported changelog content/,
  );
});

test("rejects invalid categories and versions", () => {
  assert.throws(
    () => parseChangelog(`# Changelog\n\n## [1.0.0]\n\n### Performance\n\n- Entry\n`),
    /Unsupported changelog category/,
  );
  assert.throws(
    () => parseChangelog(`# Changelog\n\n## [1.0]\n\n### Fixed\n\n- Entry\n`),
    /semantic major.minor.patch/,
  );
});
