import { describe, expect, it } from "vitest";

import {
  achievementRecordsLoaded,
  achievementRecordsLoadFailed,
  achievementRecordsRequested,
  achievementRecordsUpdated,
  achievementsInitialized,
  achievementsReducer,
} from "@/app/store/slices/achievements-slice";

function reduce(...actions: Parameters<typeof achievementsReducer>[1][]) {
  return actions.reduce(achievementsReducer, achievementsReducer(undefined, { type: "init" }));
}

const loaded = {
  discoveredSplashMessageIds: ["rainbow-mode"],
  unlockedAchievements: { "first-export": 1_000 },
};

describe("achievements slice", () => {
  it("starts uninitialized without records", () => {
    expect(reduce()).toEqual({
      initialized: false,
      records: null,
      requestId: null,
      status: "idle",
    });
  });

  it("stores the records of the latest request", () => {
    const state = reduce(
      achievementRecordsRequested({ requestId: "first" }),
      achievementRecordsLoaded({ records: loaded, requestId: "first" }),
    );

    expect(state).toMatchObject({ records: loaded, requestId: null, status: "ready" });
  });

  it("merges a superseded snapshot without settling the newer request", () => {
    const state = reduce(
      achievementRecordsRequested({ requestId: "first" }),
      achievementRecordsRequested({ requestId: "second" }),
      achievementRecordsLoaded({ records: loaded, requestId: "first" }),
    );

    expect(state).toMatchObject({ records: loaded, requestId: "second", status: "loading" });
  });

  it("never loses entries or rewrites unlock times when an older snapshot arrives late", () => {
    const newer = {
      discoveredSplashMessageIds: ["chosen-frame", "rainbow-mode"],
      unlockedAchievements: { "first-export": 1_000, "gif-maker": 2_000 },
    };

    const state = reduce(
      achievementRecordsUpdated({ records: newer }),
      achievementRecordsLoaded({
        records: {
          discoveredSplashMessageIds: ["rainbow-mode"],
          unlockedAchievements: { "first-export": 9_999 },
        },
        requestId: "stale",
      }),
    );

    expect(state.records).toEqual(newer);
  });

  it("reports a failure only when nothing has loaded yet", () => {
    expect(
      reduce(
        achievementRecordsRequested({ requestId: "first" }),
        achievementRecordsLoadFailed({ requestId: "first" }),
      ).status,
    ).toBe("failed");

    expect(
      reduce(
        achievementRecordsUpdated({ records: loaded }),
        achievementRecordsRequested({ requestId: "first" }),
        achievementRecordsLoadFailed({ requestId: "first" }),
      ).records,
    ).toEqual(loaded);
  });

  it("marks the session initialized once", () => {
    expect(reduce(achievementsInitialized(), achievementsInitialized()).initialized).toBe(true);
  });
});
