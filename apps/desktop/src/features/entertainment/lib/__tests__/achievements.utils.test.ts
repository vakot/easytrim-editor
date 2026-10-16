import { describe, expect, it } from "vitest";

import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { achievementCollection } from "../../consts/achievements.consts";
import { splashMessagesLegendary } from "../../consts/splash-messages.consts";
import type {
  AchievementSeriesDefinition,
  StandaloneAchievementDefinition,
} from "../../types/achievements.types";
import {
  countUnlockedAchievements,
  getEarnedAchievementIds,
  getSeriesProgress,
  getStandaloneAchievementProgress,
  hasNewAchievements,
  isAchievementNew,
  isEntryLocked,
  isEntryNew,
  isEntryUnlocked,
  totalUnlockableAchievements,
} from "../achievements.utils";

const MEGABYTE = 1_024 ** 2;
const GIGABYTE = 1_024 ** 3;
const legendaryIds = splashMessagesLegendary.map((message) => message.id);

function series(id: string): AchievementSeriesDefinition {
  const entry = achievementCollection.find((candidate) => candidate.id === id);
  if (entry?.kind !== "series") throw new Error(`Unknown series ${id}`);
  return entry;
}

function standalone(id: string): StandaloneAchievementDefinition {
  const entry = achievementCollection.find((candidate) => candidate.id === id);
  if (entry?.kind !== "standalone") throw new Error(`Unknown achievement ${id}`);
  return entry;
}

describe("achievement registry", () => {
  it("defines unique, stable kebab-case identifiers", () => {
    const ids = achievementCollection.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("defines ascending Bronze, Silver, and Gold thresholds for every series", () => {
    for (const entry of achievementCollection) {
      if (entry.kind !== "series") continue;
      expect(entry.thresholds.bronze).toBeLessThan(entry.thresholds.silver);
      expect(entry.thresholds.silver).toBeLessThan(entry.thresholds.gold);
    }
  });

  it("uses the agreed milestone progression", () => {
    expect(series("export-mastery").thresholds).toEqual({ bronze: 1, silver: 10, gold: 100 });
    expect(series("lossless-precision").thresholds).toEqual({ bronze: 1, silver: 10, gold: 50 });
    expect(series("time-well-spent").thresholds).toEqual({
      bronze: 60_000,
      silver: 600_000,
      gold: 3_600_000,
    });
    expect(series("data-cruncher").thresholds).toEqual({
      bronze: GIGABYTE,
      silver: 10 * GIGABYTE,
      gold: 100 * GIGABYTE,
    });
    expect(series("storage-saver").thresholds).toEqual({
      bronze: 100 * MEGABYTE,
      silver: GIGABYTE,
      gold: 10 * GIGABYTE,
    });
    expect(series("gif-creator").thresholds).toEqual({ bronze: 1, silver: 5, gold: 25 });
    expect(series("audio-specialist").thresholds).toEqual({ bronze: 1, silver: 5, gold: 25 });
  });

  it("counts three tiers per series plus each standalone achievement", () => {
    expect(totalUnlockableAchievements).toBe(22);
  });

  it("requires every legendary splash message for the secret The Chosen One", () => {
    const chosenOne = standalone("the-chosen-one");

    expect(chosenOne.secret).toBe(true);
    expect(chosenOne.target).toBe(legendaryIds.length);
  });
});

describe("tier evaluation", () => {
  it("earns every tier already reached by stored statistics", () => {
    const earned = getEarnedAchievementIds({
      records: emptyAchievementRecords,
      statistics: { ...emptyUsageStatistics, losslessExports: 12, optimizedExports: 140 },
    });

    expect(earned).toEqual(
      expect.arrayContaining([
        "export-mastery-bronze",
        "export-mastery-silver",
        "export-mastery-gold",
        "lossless-precision-bronze",
        "lossless-precision-silver",
      ]),
    );
    expect(earned).not.toContain("lossless-precision-gold");
    expect(earned).not.toContain("gif-creator-bronze");
  });

  it("unlocks each tier at exactly its threshold", () => {
    const earned = (processingMillis: number) =>
      getEarnedAchievementIds({
        records: emptyAchievementRecords,
        statistics: { ...emptyUsageStatistics, processingMillis },
      });

    expect(earned(59_999)).toEqual([]);
    expect(earned(60_000)).toEqual(["time-well-spent-bronze"]);
    expect(earned(600_000)).toEqual(["time-well-spent-bronze", "time-well-spent-silver"]);
    expect(earned(3_600_000)).toContain("time-well-spent-gold");
  });

  it("only earns tiers that are not unlocked yet", () => {
    expect(
      getEarnedAchievementIds({
        records: {
          ...emptyAchievementRecords,
          unlockedAchievements: { "gif-creator-bronze": 1_000 },
        },
        statistics: { ...emptyUsageStatistics, gifExports: 6 },
      }),
    ).toEqual(expect.arrayContaining(["gif-creator-silver"]));
  });

  it("earns nothing until the records show what is already unlocked", () => {
    expect(
      getEarnedAchievementIds({
        records: null,
        statistics: { ...emptyUsageStatistics, gifExports: 3 },
      }),
    ).toEqual([]);
  });

  it("counts only positive net storage savings", () => {
    const sources = (sourceBytes: number, outputBytes: number) => ({
      records: emptyAchievementRecords,
      statistics: { ...emptyUsageStatistics, outputBytes, sourceBytes },
    });

    expect(getEarnedAchievementIds(sources(GIGABYTE, 4 * GIGABYTE))).not.toContain(
      "storage-saver-bronze",
    );
    expect(getEarnedAchievementIds(sources(2 * GIGABYTE, 500 * MEGABYTE))).toEqual(
      expect.arrayContaining([
        "data-cruncher-bronze",
        "storage-saver-bronze",
        "storage-saver-silver",
      ]),
    );
  });

  it("counts distinct legendary discoveries only", () => {
    const sources = (discoveredSplashMessageIds: string[]) => ({
      records: { ...emptyAchievementRecords, discoveredSplashMessageIds },
      statistics: null,
    });

    expect(
      getStandaloneAchievementProgress(
        standalone("the-chosen-one"),
        sources([legendaryIds[0]!, "ffmpeg", "frame-perfect", "no-electron"]),
      ),
    ).toEqual({ current: 1, target: legendaryIds.length });
    expect(getEarnedAchievementIds(sources(legendaryIds.slice(0, -1)))).toEqual([]);
    expect(getEarnedAchievementIds(sources(legendaryIds))).toEqual(["the-chosen-one"]);
  });
});

describe("series progress", () => {
  it("shows progress toward Bronze while locked", () => {
    expect(
      getSeriesProgress(series("gif-creator"), {
        records: emptyAchievementRecords,
        statistics: emptyUsageStatistics,
      }),
    ).toMatchObject({
      current: null,
      next: { tier: "bronze" },
      progress: { current: 0, target: 1 },
    });
  });

  it("shows progress between tiers from the highest unlocked tier", () => {
    const progress = getSeriesProgress(series("lossless-precision"), {
      records: {
        ...emptyAchievementRecords,
        unlockedAchievements: {
          "lossless-precision-bronze": 1_000,
          "lossless-precision-silver": 2_000,
        },
      },
      statistics: { ...emptyUsageStatistics, losslessExports: 37 },
    });

    expect(progress.current).toMatchObject({ tier: "silver", unlockedAt: 2_000 });
    expect(progress.next).toMatchObject({ target: 50, tier: "gold" });
    expect(progress.progress).toEqual({ current: 37, target: 50 });
    expect(progress.tiers.map((tier) => tier.unlockedAt)).toEqual([1_000, 2_000, null]);
  });

  it("is complete with no further progress after Gold", () => {
    const progress = getSeriesProgress(series("export-mastery"), {
      records: {
        ...emptyAchievementRecords,
        unlockedAchievements: {
          "export-mastery-bronze": 1,
          "export-mastery-gold": 3,
          "export-mastery-silver": 2,
        },
      },
      statistics: { ...emptyUsageStatistics, optimizedExports: 250 },
    });

    expect(progress.current?.tier).toBe("gold");
    expect(progress.next).toBeNull();
    expect(progress.progress).toBeNull();
  });

  it("treats a partly unlocked series as both unlocked and locked for filtering", () => {
    const records = {
      ...emptyAchievementRecords,
      unlockedAchievements: { "audio-specialist-bronze": 1 },
    };

    expect(isEntryUnlocked(series("audio-specialist"), records)).toBe(true);
    expect(isEntryLocked(series("audio-specialist"), records)).toBe(true);
    expect(isEntryUnlocked(series("gif-creator"), records)).toBe(false);
  });
});

describe("new achievements", () => {
  const records = {
    ...emptyAchievementRecords,
    unlockedAchievements: { "export-mastery-bronze": 1_000, "export-mastery-silver": 3_000 },
    viewedAtMillis: 2_000,
  };

  it("treats achievements unlocked after the last view as new", () => {
    expect(isAchievementNew("export-mastery-bronze", records, 2_000)).toBe(false);
    expect(isAchievementNew("export-mastery-silver", records, 2_000)).toBe(true);
    expect(isAchievementNew("export-mastery-gold", records, 2_000)).toBe(false);
    expect(isEntryNew(series("export-mastery"), records, 2_000)).toBe(true);
    expect(isEntryNew(series("export-mastery"), records, 3_000)).toBe(false);
  });

  it("treats every unlock as new before the collection was ever viewed", () => {
    expect(isAchievementNew("export-mastery-bronze", records, null)).toBe(true);
    expect(hasNewAchievements({ ...records, viewedAtMillis: null })).toBe(true);
  });

  it("reports new achievements from the stored viewed mark, ignoring unknown IDs", () => {
    expect(hasNewAchievements(records)).toBe(true);
    expect(hasNewAchievements({ ...records, viewedAtMillis: 3_000 })).toBe(false);
    expect(
      hasNewAchievements({
        ...emptyAchievementRecords,
        unlockedAchievements: { "retired-achievement": 5_000 },
        viewedAtMillis: 1_000,
      }),
    ).toBe(false);
    expect(hasNewAchievements(null)).toBe(false);
  });
});

describe("unlocked count", () => {
  it("counts every unlocked tier and standalone achievement, ignoring unknown IDs", () => {
    expect(
      countUnlockedAchievements({
        ...emptyAchievementRecords,
        unlockedAchievements: {
          "export-mastery-bronze": 1,
          "export-mastery-silver": 2,
          "first-export": 3,
          "the-chosen-one": 4,
        },
      }),
    ).toBe(3);
  });
});
