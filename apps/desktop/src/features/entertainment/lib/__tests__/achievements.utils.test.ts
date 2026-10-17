import { describe, expect, it } from "vitest";

import {
  completeAchievementRecords,
  completeAchievementStatistics,
  emptyAchievementRecords,
  partiallyUnlockedAchievementScenario,
} from "@/test/achievement-records.fixtures";
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
    expect(totalUnlockableAchievements).toBe(25);
  });

  it("requires every legendary splash message for the secret The Chosen One", () => {
    const chosenOne = standalone("the-chosen-one");

    expect(chosenOne.secret).toBe(true);
    expect(chosenOne.condition).toEqual({ ids: legendaryIds, kind: "discovery" });
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
    ).toEqual({ current: 1, target: legendaryIds.length, unit: "count" });
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

  it("shows the real total against the Gold threshold after Gold", () => {
    const records = {
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "export-mastery-bronze": 1,
        "export-mastery-gold": 3,
        "export-mastery-silver": 2,
      },
    };

    const progress = (optimizedExports: number) =>
      getSeriesProgress(series("export-mastery"), {
        records,
        statistics: { ...emptyUsageStatistics, optimizedExports },
      });

    expect(progress(250)).toMatchObject({
      current: { tier: "gold" },
      next: null,
      progress: { current: 250, target: 100 },
    });
    expect(progress(100).progress).toEqual({ current: 100, target: 100 });
    expect(
      getSeriesProgress(series("export-mastery"), { records, statistics: null }).progress,
    ).toBeNull();
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

const originalSeriesIds = [
  "export-mastery",
  "lossless-precision",
  "gif-creator",
  "audio-specialist",
  "time-well-spent",
  "data-cruncher",
  "storage-saver",
] as const;

const tierIdsOf = (tier: string) => originalSeriesIds.map((id) => `${id}-${tier}`);

/** The literal prerequisites of each collector, fixed at release. */
const collectorRequirements = {
  "bronze-collector": tierIdsOf("bronze"),
  "gold-collector": tierIdsOf("gold"),
  "silver-collector": tierIdsOf("silver"),
};

function unlockedRecords(ids: readonly string[], unlockedAt = 1_000) {
  return {
    ...emptyAchievementRecords,
    unlockedAchievements: Object.fromEntries(ids.map((id) => [id, unlockedAt])),
  };
}

/** Statistics that reach every Gold tier of the original series. */
const goldStatistics = {
  ...emptyUsageStatistics,
  audioExports: 25,
  gifExports: 25,
  losslessExports: 50,
  optimizedExports: 100,
  outputBytes: 10 * GIGABYTE,
  processingMillis: 3_600_000,
  sourceBytes: 120 * GIGABYTE,
};

describe("collector registry", () => {
  it("defines three secret collectors that require the original tiers by explicit literal IDs", () => {
    for (const [id, requires] of Object.entries(collectorRequirements)) {
      const collector = standalone(id);

      expect(collector.secret).toBe(true);
      expect(collector.condition).toEqual({ kind: "collection", requires });
      expect(requires).toHaveLength(7);
    }
  });

  it("never lets a collector require itself, another collector, or an unknown achievement", () => {
    const collectorIds = Object.keys(collectorRequirements);
    const tierIds = new Set(
      achievementCollection.flatMap((entry) =>
        entry.kind === "series"
          ? (["bronze", "silver", "gold"] as const).map((tier) => `${entry.id}-${tier}`)
          : [],
      ),
    );

    for (const entry of achievementCollection) {
      if (entry.kind !== "standalone" || entry.condition.kind !== "collection") continue;
      for (const required of entry.condition.requires) {
        expect(required).not.toBe(entry.id);
        expect(collectorIds).not.toContain(required);
        expect(tierIds).toContain(required);
      }
    }
  });

  it("keeps collector and tier identifiers unique", () => {
    const ids = achievementCollection.flatMap((entry) =>
      entry.kind === "series"
        ? [`${entry.id}-bronze`, `${entry.id}-silver`, `${entry.id}-gold`]
        : [entry.id],
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("collector evaluation", () => {
  it.each([
    ["bronze-collector", "bronze"],
    ["silver-collector", "silver"],
    ["gold-collector", "gold"],
  ])("unlocks %s once its final %s tier is unlocked", (collector, tier) => {
    const tiers = tierIdsOf(tier);
    const missingOne = unlockedRecords(tiers.slice(0, -1));

    expect(getEarnedAchievementIds({ records: missingOne, statistics: null })).toEqual([]);
    expect(getEarnedAchievementIds({ records: unlockedRecords(tiers), statistics: null })).toEqual([
      collector,
    ]);
  });

  it("resolves chained unlocks within one evaluation, tiers before their collector", () => {
    const earned = getEarnedAchievementIds({
      records: emptyAchievementRecords,
      statistics: goldStatistics,
    });

    for (const [collector, requires] of Object.entries(collectorRequirements)) {
      expect(earned).toContain(collector);
      for (const required of requires) {
        expect(earned).toContain(required);
        expect(earned.indexOf(required)).toBeLessThan(earned.indexOf(collector));
      }
    }
    expect(new Set(earned).size).toBe(earned.length);
    expect(earned).toHaveLength(24);
  });

  it("earns the collector together with the final tier that completes it", () => {
    const records = unlockedRecords(tierIdsOf("bronze").slice(0, -1));

    expect(
      getEarnedAchievementIds({
        records,
        statistics: {
          ...emptyUsageStatistics,
          outputBytes: 100 * MEGABYTE,
          sourceBytes: 300 * MEGABYTE,
        },
      }),
    ).toEqual(["storage-saver-bronze", "bronze-collector"]);
  });

  it("retroactively unlocks collectors from tiers unlocked before they existed", () => {
    const records = unlockedRecords([...tierIdsOf("bronze"), ...tierIdsOf("silver")]);

    expect(getEarnedAchievementIds({ records, statistics: null })).toEqual([
      "bronze-collector",
      "silver-collector",
    ]);
  });

  it("does not unlock a collector twice or change its original unlock time", () => {
    const records = unlockedRecords([...tierIdsOf("gold"), "gold-collector"], 42);

    expect(getEarnedAchievementIds({ records, statistics: goldStatistics })).not.toContain(
      "gold-collector",
    );
    expect(records.unlockedAchievements["gold-collector"]).toBe(42);
  });

  it("does not need lower tiers for a higher collector", () => {
    expect(
      getEarnedAchievementIds({ records: unlockedRecords(tierIdsOf("gold")), statistics: null }),
    ).toEqual(["gold-collector"]);
  });

  it("reports collector progress as unlocked required achievements out of seven", () => {
    expect(
      getStandaloneAchievementProgress(standalone("silver-collector"), {
        records: unlockedRecords(tierIdsOf("silver").slice(0, 3)),
        statistics: null,
      }),
    ).toEqual({ current: 3, target: 7, unit: "count" });
  });
});

describe("catalog evolution", () => {
  const newSeries: AchievementSeriesDefinition = {
    ...series("gif-creator"),
    id: "brand-new-series",
    thresholds: { bronze: 1, silver: 2, gold: 3 },
  };

  const withNewSeries = [...achievementCollection, newSeries];

  function withGifThresholds(thresholds: AchievementSeriesDefinition["thresholds"]) {
    return achievementCollection.map((entry) =>
      entry.id === "gif-creator" && entry.kind === "series" ? { ...entry, thresholds } : entry,
    );
  }

  it("leaves existing collectors unchanged when a new series is added", () => {
    // Missing the new series' Bronze tier does not hold the collector back...
    expect(
      getEarnedAchievementIds(
        { records: unlockedRecords(tierIdsOf("bronze")), statistics: null },
        withNewSeries,
      ),
    ).toEqual(["bronze-collector"]);
    // ...and unlocking it does not become a requirement.
    expect(collectorRequirements["bronze-collector"]).not.toContain("brand-new-series-bronze");
    expect(standalone("bronze-collector").condition).toEqual({
      kind: "collection",
      requires: tierIdsOf("bronze"),
    });
  });

  it("evaluates a newly introduced series retroactively against historical statistics", () => {
    const earned = getEarnedAchievementIds(
      { records: emptyAchievementRecords, statistics: { ...emptyUsageStatistics, gifExports: 2 } },
      withNewSeries,
    );

    expect(earned).toEqual(
      expect.arrayContaining(["brand-new-series-bronze", "brand-new-series-silver"]),
    );
    expect(earned).not.toContain("brand-new-series-gold");
  });

  it("unlocks retroactively when a threshold is lowered", () => {
    const sources = {
      records: emptyAchievementRecords,
      statistics: { ...emptyUsageStatistics, gifExports: 4 },
    };

    expect(getEarnedAchievementIds(sources)).not.toContain("gif-creator-silver");
    expect(
      getEarnedAchievementIds(sources, withGifThresholds({ bronze: 1, silver: 3, gold: 4 })),
    ).toEqual(expect.arrayContaining(["gif-creator-silver", "gif-creator-gold"]));
  });

  it("never revokes unlocked achievements or changes their timestamps when a threshold is raised", () => {
    const records = unlockedRecords(
      ["gif-creator-bronze", "gif-creator-silver", "gif-creator-gold"],
      7_000,
    );

    const snapshot = structuredClone(records);
    const raised = withGifThresholds({ bronze: 100, silver: 500, gold: 1_000 });
    const sources = { records, statistics: { ...emptyUsageStatistics, gifExports: 5 } };
    const raisedSeries = raised.find(
      (entry) => entry.id === "gif-creator",
    ) as AchievementSeriesDefinition;

    expect(
      getEarnedAchievementIds(sources, raised).filter((id) => id.startsWith("gif-creator")),
    ).toEqual([]);
    expect(countUnlockedAchievements(records, raised)).toBe(3);
    expect(getSeriesProgress(raisedSeries, sources).current).toMatchObject({
      tier: "gold",
      unlockedAt: 7_000,
    });
    expect(records).toEqual(snapshot);
  });

  it("keeps the history of retired achievements and still counts it toward collectors", () => {
    const withoutStorageSaver = achievementCollection.filter(
      (entry) => entry.id !== "storage-saver",
    );

    const records = unlockedRecords([...tierIdsOf("gold"), "retired-achievement"]);

    // The retired series' unlocks remain in the records, so the collector is still earned.
    expect(getEarnedAchievementIds({ records, statistics: null }, withoutStorageSaver)).toEqual([
      "gold-collector",
    ]);
    // The active catalog forgets retired achievements for counting only.
    expect(countUnlockedAchievements(records, withoutStorageSaver)).toBe(6);
    expect(Object.keys(records.unlockedAchievements)).toEqual(
      expect.arrayContaining(["retired-achievement", "storage-saver-gold"]),
    );
  });

  it("keeps an unlock and its timestamp when the catalog is evaluated again", () => {
    const records = unlockedRecords(["storage-saver-bronze"], 9_000);

    expect(
      getEarnedAchievementIds({
        records,
        statistics: { ...emptyUsageStatistics, outputBytes: 0, sourceBytes: 3 * GIGABYTE },
      }),
    ).not.toContain("storage-saver-bronze");
    expect(records.unlockedAchievements["storage-saver-bronze"]).toBe(9_000);
  });
});

describe("tier threshold boundaries", () => {
  const tiers = ["bronze", "silver", "gold"] as const;
  const seriesEntries = achievementCollection.flatMap((entry) =>
    entry.kind === "series" ? [series(entry.id)] : [],
  );

  /** Statistics whose only non-empty value is the given metric. */
  function statisticsFor(series: AchievementSeriesDefinition, value: number) {
    switch (series.metric) {
      case "audioExports":
      case "gifExports":
      case "losslessExports":
      case "processingMillis":
      case "sourceBytes":
        return { ...emptyUsageStatistics, [series.metric]: value };
      case "completedExports":
        return { ...emptyUsageStatistics, optimizedExports: value };
      case "storageSavedBytes":
        return { ...emptyUsageStatistics, sourceBytes: value };
    }
  }

  const cases = seriesEntries.flatMap((entry) =>
    tiers.map((tier) => ({ id: `${entry.id}-${tier}`, entry, threshold: entry.thresholds[tier] })),
  );

  it.each(cases)(
    "unlocks $id exactly at its threshold of $threshold",
    ({ entry, id, threshold }) => {
      const earnedAt = (value: number) =>
        getEarnedAchievementIds({
          records: emptyAchievementRecords,
          statistics: statisticsFor(entry, value),
        });

      expect(earnedAt(threshold - 1)).not.toContain(id);
      expect(earnedAt(threshold)).toContain(id);
      expect(earnedAt(threshold + 1)).toContain(id);
    },
  );

  it.each(seriesEntries.map((entry) => [entry.id, entry] as const))(
    "shows the highest tier whose threshold is reached on %s once it is recorded",
    (_id, entry) => {
      for (const tier of tiers) {
        for (const delta of [-1, 0, 1]) {
          const statistics = statisticsFor(entry, entry.thresholds[tier] + delta);
          const earned = getEarnedAchievementIds({ records: emptyAchievementRecords, statistics });
          const records = unlockedRecords(earned);
          const reached = tiers.filter(
            (candidate) => entry.thresholds[candidate] <= entry.thresholds[tier] + delta,
          );

          expect(getSeriesProgress(entry, { records, statistics }).current?.tier ?? null).toBe(
            reached.at(-1) ?? null,
          );
        }
      }
    },
  );

  it("takes the unlock state from the records, not from the metric", () => {
    const entry = series("export-mastery");
    const statistics = statisticsFor(entry, entry.thresholds.silver);

    expect(
      getSeriesProgress(entry, { records: emptyAchievementRecords, statistics }).current,
    ).toBeNull();
  });
});

describe("shared fixtures", () => {
  it("agree with the evaluation: the partial scenario has nothing left to earn", () => {
    expect(getEarnedAchievementIds(partiallyUnlockedAchievementScenario)).toEqual([]);
  });

  it("agree with the evaluation: the complete records are what the complete statistics earn", () => {
    const earned = getEarnedAchievementIds({
      records: {
        ...emptyAchievementRecords,
        discoveredSplashMessageIds: completeAchievementRecords.discoveredSplashMessageIds,
      },
      statistics: completeAchievementStatistics,
    });

    expect([...earned].sort()).toEqual(
      Object.keys(completeAchievementRecords.unlockedAchievements).sort(),
    );
  });
});
