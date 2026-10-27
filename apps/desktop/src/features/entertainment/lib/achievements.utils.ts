import type { TFunction } from "i18next";

import type { AchievementTier } from "@easytrim-editor/ui/achievement-tier-styles";

import type { AchievementRecords } from "@/domain/achievement-records";
import {
  getCompletedExports,
  getStorageSavedBytes,
  type UsageStatistics,
} from "@/domain/usage-statistics";

import { achievementCollection, achievementTiers } from "../consts/achievements.consts";
import type {
  AchievementCollectionEntry,
  AchievementCondition,
  AchievementMetric,
  AchievementSeriesDefinition,
  StandaloneAchievementDefinition,
  UnlockableAchievement,
} from "../types/achievements.types";

/** The data achievement progress is derived from; either part is null until it has loaded. */
type AchievementSources = {
  records: AchievementRecords | null;
  statistics: UsageStatistics | null;
};

type AchievementMetricUnit = "bytes" | "count" | "duration";

type AchievementProgressValue = { current: number; target: number };

type AchievementTierStatus = {
  id: string;
  target: number;
  tier: AchievementTier;
  unlockedAt: number | null;
};

const achievementMetricUnits: Record<AchievementMetric, AchievementMetricUnit> = {
  audioExports: "count",
  completedExports: "count",
  gifExports: "count",
  losslessExports: "count",
  processingMillis: "duration",
  sourceBytes: "bytes",
  storageSavedBytes: "bytes",
};

function getTierAchievementId(seriesId: string, tier: AchievementTier): string {
  return `${seriesId}-${tier}`;
}

/** Every independently unlockable achievement: each tier of each series and each standalone one. */
function listUnlockableAchievements(
  collection: readonly AchievementCollectionEntry[],
): UnlockableAchievement[] {
  return collection.flatMap((entry): UnlockableAchievement[] =>
    entry.kind === "series"
      ? achievementTiers.map((tier) => ({
          condition: { kind: "metric", metric: entry.metric, target: entry.thresholds[tier] },
          entry,
          id: getTierAchievementId(entry.id, tier),
          tier,
        }))
      : [{ condition: entry.condition, entry, id: entry.id, tier: null }],
  );
}

const unlockableAchievements = listUnlockableAchievements(achievementCollection);

const unlockableAchievementsById = new Map(
  unlockableAchievements.map((achievement) => [achievement.id, achievement]),
);

/** The number of unlockable achievements, counting every tier. */
const totalUnlockableAchievements = unlockableAchievements.length;

/** The unlockable achievements of a catalog; the application's own catalog is listed once. */
function resolveCatalog(
  collection: readonly AchievementCollectionEntry[],
): readonly UnlockableAchievement[] {
  return collection === achievementCollection
    ? unlockableAchievements
    : listUnlockableAchievements(collection);
}

/** Reads a metric, or null while the data it comes from is unavailable. */
function readAchievementMetric(
  metric: AchievementMetric,
  statistics: UsageStatistics | null,
): number | null {
  if (!statistics) return null;
  switch (metric) {
    case "audioExports":
      return statistics.audioExports;
    case "completedExports":
      return getCompletedExports(statistics);
    case "gifExports":
      return statistics.gifExports;
    case "losslessExports":
      return statistics.losslessExports;
    case "processingMillis":
      return statistics.processingMillis;
    case "sourceBytes":
      return statistics.sourceBytes;
    case "storageSavedBytes":
      return Math.max(0, getStorageSavedBytes(statistics));
  }
}

function getAchievementUnlockedAt(id: string, records: AchievementRecords | null): number | null {
  return records?.unlockedAchievements[id] ?? null;
}

function getUnlockableAchievement(id: string): UnlockableAchievement | undefined {
  return unlockableAchievementsById.get(id);
}

/**
 * Whether a condition holds. Collections are checked against `unlockedIds`, which includes
 * achievements unlocked earlier in the same evaluation, so unlocks can chain.
 */
function isConditionMet(
  condition: AchievementCondition,
  { records, statistics }: AchievementSources,
  unlockedIds: ReadonlySet<string>,
): boolean {
  switch (condition.kind) {
    case "event":
      return false;
    case "collection":
      return condition.requires.length > 0 && condition.requires.every((id) => unlockedIds.has(id));
    case "discovery": {
      const discovered = new Set(records?.discoveredSplashMessageIds);
      return condition.ids.length > 0 && condition.ids.every((id) => discovered.has(id));
    }
    case "metric": {
      const value = readAchievementMetric(condition.metric, statistics);
      return value !== null && value >= condition.target;
    }
  }
}

/**
 * Achievements whose conditions the current data meets but that are not unlocked yet, including
 * ones that only become met because another achievement is earned in the same evaluation. The
 * records decide what is already unlocked, retired achievements included, so nothing is earned
 * before they load and an existing unlock is never earned again. Raising a threshold therefore
 * never revokes anything, and lowering one earns the achievement retroactively.
 */
function getEarnedAchievementIds(
  sources: AchievementSources,
  collection: readonly AchievementCollectionEntry[] = achievementCollection,
): string[] {
  const { records } = sources;
  if (!records) return [];
  const candidates = resolveCatalog(collection);
  const unlocked = new Set(Object.keys(records.unlockedAchievements));
  const earned: string[] = [];

  // Each pass can earn what a collection was waiting for, so repeat until nothing changes.
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const achievement of candidates) {
      if (unlocked.has(achievement.id)) continue;
      if (!isConditionMet(achievement.condition, sources, unlocked)) continue;
      unlocked.add(achievement.id);
      earned.push(achievement.id);
      progressed = true;
    }
  }
  return earned;
}

/** Counts unlocked tiers and standalone achievements; retired and unknown IDs are ignored. */
function countUnlockedAchievements(
  records: AchievementRecords,
  collection: readonly AchievementCollectionEntry[] = achievementCollection,
): number {
  return resolveCatalog(collection).filter(
    (achievement) => getAchievementUnlockedAt(achievement.id, records) !== null,
  ).length;
}

/** Progress toward a target, capped at the target, or null while it cannot be measured. */
function getProgressToward(
  metric: AchievementMetric,
  target: number,
  sources: AchievementSources,
): AchievementProgressValue | null {
  const value = readAchievementMetric(metric, sources.statistics);
  if (value === null) return null;
  return { current: Math.min(value, target), target };
}

/**
 * The tracked metric against a target without capping it, so a completed series can show the real
 * total, or null while it cannot be measured.
 */
function getTotalToward(
  metric: AchievementMetric,
  target: number,
  sources: AchievementSources,
): AchievementProgressValue | null {
  const value = readAchievementMetric(metric, sources.statistics);
  return value === null ? null : { current: value, target };
}

/** Progress toward a standalone achievement and the unit to show it in, or null if unmeasurable. */
function getStandaloneAchievementProgress(
  definition: StandaloneAchievementDefinition,
  sources: AchievementSources,
): (AchievementProgressValue & { unit: AchievementMetricUnit }) | null {
  const { condition } = definition;
  switch (condition.kind) {
    case "event":
      return null;
    case "metric": {
      const progress = getProgressToward(condition.metric, condition.target, sources);
      return progress && { ...progress, unit: achievementMetricUnits[condition.metric] };
    }
    case "discovery": {
      if (!sources.records) return null;
      const discovered = new Set(sources.records.discoveredSplashMessageIds);
      return {
        current: condition.ids.filter((id) => discovered.has(id)).length,
        target: condition.ids.length,
        unit: "count",
      };
    }
    case "collection": {
      if (!sources.records) return null;
      const { unlockedAchievements } = sources.records;
      return {
        current: condition.requires.filter((id) => id in unlockedAchievements).length,
        target: condition.requires.length,
        unit: "count",
      };
    }
  }
}

/** Each tier of a series with its threshold and unlock time, from Bronze to Gold. */
function getSeriesTiers(
  series: AchievementSeriesDefinition,
  records: AchievementRecords | null,
): AchievementTierStatus[] {
  return achievementTiers.map((tier) => {
    const id = getTierAchievementId(series.id, tier);
    return {
      id,
      target: series.thresholds[tier],
      tier,
      unlockedAt: getAchievementUnlockedAt(id, records),
    };
  });
}

/**
 * The highest unlocked tier, the first tier still locked, and progress toward it. Unlocks come from
 * the records, so a tier counts only once it was actually unlocked. After Gold there is no next
 * tier, and `progress` is the real total against the Gold threshold, which may exceed it.
 */
function getSeriesProgress(series: AchievementSeriesDefinition, sources: AchievementSources) {
  const tiers = getSeriesTiers(series, sources.records);
  const unlocked = tiers.filter((tier) => tier.unlockedAt !== null);
  const next = tiers.find((tier) => tier.unlockedAt === null) ?? null;

  return {
    current: unlocked.at(-1) ?? null,
    next,
    progress: next
      ? getProgressToward(series.metric, next.target, sources)
      : getTotalToward(series.metric, series.thresholds.gold, sources),
    tiers,
  };
}

function isEntryUnlocked(entry: AchievementCollectionEntry, records: AchievementRecords): boolean {
  return entry.kind === "series"
    ? getSeriesTiers(entry, records).some((tier) => tier.unlockedAt !== null)
    : getAchievementUnlockedAt(entry.id, records) !== null;
}

function isEntryLocked(entry: AchievementCollectionEntry, records: AchievementRecords): boolean {
  return entry.kind === "series"
    ? getSeriesTiers(entry, records).some((tier) => tier.unlockedAt === null)
    : getAchievementUnlockedAt(entry.id, records) === null;
}

/**
 * Whether an achievement was unlocked after `viewedAtMillis`, when the collection was viewed; a
 * collection that was never viewed makes every unlocked achievement new.
 */
function isAchievementNew(
  id: string,
  records: AchievementRecords | null,
  viewedAtMillis: number | null,
): boolean {
  const unlockedAt = getAchievementUnlockedAt(id, records);
  if (unlockedAt === null) return false;
  return viewedAtMillis === null || unlockedAt > viewedAtMillis;
}

/** Whether any tier or standalone achievement of the collection is new. */
function hasNewAchievements(records: AchievementRecords | null): boolean {
  const viewedAt = records?.viewedAtMillis ?? null;
  return unlockableAchievements.some((achievement) =>
    isAchievementNew(achievement.id, records, viewedAt),
  );
}

function isEntryNew(
  entry: AchievementCollectionEntry,
  records: AchievementRecords | null,
  viewedAtMillis: number | null,
): boolean {
  return entry.kind === "series"
    ? getSeriesTiers(entry, records).some((tier) =>
        isAchievementNew(tier.id, records, viewedAtMillis),
      )
    : isAchievementNew(entry.id, records, viewedAtMillis);
}

function getAchievementTierLabel(tier: AchievementTier, t: TFunction): string {
  switch (tier) {
    case "bronze":
      return t("achievements.tiers.bronze");
    case "gold":
      return t("achievements.tiers.gold");
    case "silver":
      return t("achievements.tiers.silver");
  }
}

export {
  achievementMetricUnits,
  countUnlockedAchievements,
  getAchievementTierLabel,
  getAchievementUnlockedAt,
  getEarnedAchievementIds,
  getSeriesProgress,
  getStandaloneAchievementProgress,
  getUnlockableAchievement,
  hasNewAchievements,
  isAchievementNew,
  isEntryLocked,
  isEntryNew,
  isEntryUnlocked,
  totalUnlockableAchievements,
};
export type {
  AchievementMetricUnit,
  AchievementProgressValue,
  AchievementSources,
  AchievementTierStatus,
};
