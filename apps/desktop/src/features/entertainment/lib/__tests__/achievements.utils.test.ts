import { describe, expect, it } from "vitest";

import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { achievementDefinitions } from "../../consts/achievements.consts";
import { splashMessagesLegendary } from "../../consts/splash-messages.consts";
import {
  countUnlockedAchievements,
  getAchievementDefinition,
  getAchievementProgress,
  getEarnedAchievementIds,
} from "../achievements.utils";

const GIGABYTE = 1_024 ** 3;
const legendaryIds = splashMessagesLegendary.map((message) => message.id);

function definition(id: string) {
  const found = getAchievementDefinition(id);
  if (!found) throw new Error(`Unknown achievement ${id}`);
  return found;
}

describe("achievement registry", () => {
  it("defines a unique, stable kebab-case identifier for every achievement", () => {
    const ids = achievementDefinitions.map((achievement) => achievement.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("requires every legendary splash message for The Chosen One", () => {
    const chosenOne = definition("the-chosen-one");

    expect(chosenOne.secret).toBe(true);
    expect(chosenOne.target).toBe(legendaryIds.length);
    expect(chosenOne.target).toBe(5);
  });
});

describe("achievement evaluation", () => {
  it("earns every export milestone already reached by stored statistics", () => {
    const earned = getEarnedAchievementIds({
      records: emptyAchievementRecords,
      statistics: { ...emptyUsageStatistics, losslessExports: 50, optimizedExports: 100 },
    });

    expect(earned).toEqual(
      expect.arrayContaining(["first-export", "getting-started", "export-veteran"]),
    );
    expect(earned).toContain("first-lossless-cut");
    expect(earned).not.toContain("export-legend");
    expect(earned).not.toContain("lossless-legend");
  });

  it("unlocks at exactly the threshold", () => {
    const sources = (processingMillis: number) => ({
      records: emptyAchievementRecords,
      statistics: { ...emptyUsageStatistics, processingMillis },
    });

    expect(getEarnedAchievementIds(sources(3_599_999))).not.toContain("one-hour-later");
    expect(getEarnedAchievementIds(sources(3_600_000))).toContain("one-hour-later");
    expect(getEarnedAchievementIds(sources(24 * 3_600_000))).toContain("working-overtime");
  });

  it("does not earn an achievement again once it is unlocked", () => {
    expect(
      getEarnedAchievementIds({
        records: { ...emptyAchievementRecords, unlockedAchievements: { "gif-maker": 1_000 } },
        statistics: { ...emptyUsageStatistics, gifExports: 3 },
      }),
    ).not.toContain("gif-maker");
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
    const storageSaver = definition("storage-saver");

    expect(
      getAchievementProgress(storageSaver, {
        records: emptyAchievementRecords,
        statistics: { ...emptyUsageStatistics, outputBytes: 4 * GIGABYTE, sourceBytes: GIGABYTE },
      }),
    ).toEqual({ current: 0, target: 10 * GIGABYTE });
    expect(
      getEarnedAchievementIds({
        records: emptyAchievementRecords,
        statistics: {
          ...emptyUsageStatistics,
          outputBytes: 5 * GIGABYTE,
          sourceBytes: 115 * GIGABYTE,
        },
      }),
    ).toEqual(expect.arrayContaining(["data-cruncher", "storage-saver"]));
  });

  it("caps progress at the target and reports it as unavailable without its data", () => {
    const veteran = definition("export-veteran");

    expect(
      getAchievementProgress(veteran, {
        records: null,
        statistics: { ...emptyUsageStatistics, audioExports: 150 },
      }),
    ).toEqual({ current: 100, target: 100 });
    expect(getAchievementProgress(veteran, { records: null, statistics: null })).toBeNull();
  });

  it("counts distinct legendary discoveries only", () => {
    const chosenOne = definition("the-chosen-one");
    const sources = (discoveredSplashMessageIds: string[]) => ({
      records: { ...emptyAchievementRecords, discoveredSplashMessageIds },
      statistics: null,
    });

    expect(
      getAchievementProgress(
        chosenOne,
        sources([legendaryIds[0]!, "ffmpeg", "frame-perfect", "no-electron"]),
      ),
    ).toEqual({ current: 1, target: 5 });
    expect(getEarnedAchievementIds(sources(legendaryIds.slice(0, 4)))).toEqual([]);
    expect(getEarnedAchievementIds(sources(legendaryIds))).toEqual(["the-chosen-one"]);
  });

  it("counts unlocked achievements of the current collection only", () => {
    expect(
      countUnlockedAchievements({
        ...emptyAchievementRecords,
        unlockedAchievements: { "first-export": 1, "gif-maker": 2, "retired-achievement": 3 },
      }),
    ).toBe(2);
  });
});
