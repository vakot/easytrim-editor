import type { TFunction } from "i18next";

import type { AchievementRecords } from "@/domain/achievement-records";
import {
  getCompletedExports,
  getStorageSavedBytes,
  type UsageStatistics,
} from "@/domain/usage-statistics";

import { achievementCollection, achievementTiers } from "../consts/achievements.consts";
import { splashMessagesLegendary } from "../consts/splash-messages.consts";
import type {
  AchievementCollectionEntry,
  AchievementMetric,
  AchievementSeriesDefinition,
  AchievementTier,
  StandaloneAchievementDefinition,
  UnlockableAchievement,
} from "../types/achievements.types";

/** The data achievement progress is derived from; either part is null until it has loaded. */
type AchievementSources = {
  records: AchievementRecords | null;
  statistics: UsageStatistics | null;
};

type AchievementMetricUnit = "bytes" | "count" | "duration";

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
  legendarySplashMessages: "count",
  losslessExports: "count",
  processingMillis: "duration",
  sourceBytes: "bytes",
  storageSavedBytes: "bytes",
};

const legendarySplashMessageIds = new Set<string>(
  splashMessagesLegendary.map((message) => message.id),
);

function getTierAchievementId(seriesId: string, tier: AchievementTier): string {
  return `${seriesId}-${tier}`;
}

/** Every independently unlockable achievement: each tier of each series and each standalone one. */
const unlockableAchievements: readonly UnlockableAchievement[] = achievementCollection.flatMap(
  (entry: AchievementCollectionEntry): UnlockableAchievement[] =>
    entry.kind === "series"
      ? achievementTiers.map((tier) => ({
          entry,
          id: getTierAchievementId(entry.id, tier),
          metric: entry.metric,
          target: entry.thresholds[tier],
          tier,
        }))
      : [{ entry, id: entry.id, metric: entry.metric, target: entry.target, tier: null }],
);

const unlockableAchievementsById = new Map(
  unlockableAchievements.map((achievement) => [achievement.id, achievement]),
);

/** The number of unlockable achievements, counting every tier. */
const totalUnlockableAchievements = unlockableAchievements.length;

/** Reads a metric, or null while the data it comes from is unavailable. */
function readAchievementMetric(
  metric: AchievementMetric,
  { records, statistics }: AchievementSources,
): number | null {
  if (metric === "legendarySplashMessages") {
    return records
      ? records.discoveredSplashMessageIds.filter((id) => legendarySplashMessageIds.has(id)).length
      : null;
  }
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
 * Achievements whose targets the current data reaches but that are not unlocked yet. Nothing is
 * earned before the records load, because only they tell which achievements are already unlocked.
 */
function getEarnedAchievementIds(sources: AchievementSources): string[] {
  const { records } = sources;
  if (!records) return [];
  return unlockableAchievements
    .filter((achievement) => {
      if (getAchievementUnlockedAt(achievement.id, records) !== null) return false;
      const value = readAchievementMetric(achievement.metric, sources);
      return value !== null && value >= achievement.target;
    })
    .map((achievement) => achievement.id);
}

/** Counts unlocked tiers and standalone achievements; unknown stored IDs are ignored. */
function countUnlockedAchievements(records: AchievementRecords): number {
  return unlockableAchievements.filter(
    (achievement) => getAchievementUnlockedAt(achievement.id, records) !== null,
  ).length;
}

/** Progress toward a target, capped at the target, or null while it cannot be measured. */
function getProgressToward(
  metric: AchievementMetric,
  target: number,
  sources: AchievementSources,
): { current: number; target: number } | null {
  const value = readAchievementMetric(metric, sources);
  if (value === null) return null;
  return { current: Math.min(value, target), target };
}

function getStandaloneAchievementProgress(
  definition: StandaloneAchievementDefinition,
  sources: AchievementSources,
): { current: number; target: number } | null {
  return getProgressToward(definition.metric, definition.target, sources);
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
 * the records, so a tier counts only once it was actually unlocked.
 */
function getSeriesProgress(series: AchievementSeriesDefinition, sources: AchievementSources) {
  const tiers = getSeriesTiers(series, sources.records);
  const unlocked = tiers.filter((tier) => tier.unlockedAt !== null);
  const next = tiers.find((tier) => tier.unlockedAt === null) ?? null;

  return {
    current: unlocked.at(-1) ?? null,
    next,
    progress: next ? getProgressToward(series.metric, next.target, sources) : null,
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

function compareAchievementTiers(left: AchievementTier, right: AchievementTier): number {
  return achievementTiers.indexOf(left) - achievementTiers.indexOf(right);
}

export {
  achievementMetricUnits,
  compareAchievementTiers,
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
export type { AchievementMetricUnit, AchievementSources, AchievementTierStatus };
