import { describe, expect, it } from "vitest";

import {
  getAvailableChangelog,
  getChangelogStartupState,
  getUnseenChangelog,
} from "../changelog.utils";

const releases = [
  { version: "1.10.4", sections: [] },
  { version: "1.10.3", sections: [] },
  { version: "1.10.2", sections: [] },
  { version: "1.9.0", sections: [] },
  { version: "2.0.0", sections: [] },
];

describe("changelog filtering", () => {
  it("uses semantic version ordering rather than lexical ordering", () => {
    expect(getAvailableChangelog(releases, "1.10.4").map((release) => release.version)).toEqual([
      "1.10.4",
      "1.10.3",
      "1.10.2",
      "1.9.0",
    ]);
  });

  it("filters releases newer than the installed application", () => {
    expect(getAvailableChangelog(releases, "1.10.2").map((release) => release.version)).toEqual([
      "1.10.2",
      "1.9.0",
    ]);
  });

  it("returns one unseen release after a one-version update", () => {
    expect(
      getUnseenChangelog(releases, "1.10.3", "1.10.4").map((release) => release.version),
    ).toEqual(["1.10.4"]);
  });

  it("returns every skipped release up to the installed version", () => {
    expect(
      getUnseenChangelog(releases, "1.10.2", "1.10.4").map((release) => release.version),
    ).toEqual(["1.10.4", "1.10.3"]);
  });

  it("does not treat a missing first-run version as unseen history", () => {
    expect(getUnseenChangelog(releases, null, "1.10.4")).toEqual([]);
  });

  it("initializes first run at the installed version", () => {
    expect(getChangelogStartupState(releases, null, "1.10.4")).toEqual({
      initializeSeenVersion: "1.10.4",
      unseenReleases: [],
    });
  });

  it("initializes safely when persisted version data is invalid", () => {
    expect(getChangelogStartupState(releases, "not-a-version", "1.10.4")).toEqual({
      initializeSeenVersion: "1.10.4",
      unseenReleases: [],
    });
  });
});
