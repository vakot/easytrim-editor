import type { AchievementRecords } from "@/domain/achievement-records";
import {
  getCompletedExports,
  getStorageSavedBytes,
  type UsageStatistics,
} from "@/domain/usage-statistics";

import { achievementDefinitions } from "../consts/achievements.consts";
import { splashMessagesLegendary } from "../consts/splash-messages.consts";
import type { AchievementDefinition, AchievementMetric } from "../types/achievements.types";

/** The data achievement progress is derived from; either part is null until it has loaded. */
type AchievementSources = {
  records: AchievementRecords | null;
  statistics: UsageStatistics | null;
};

type AchievementMetricUnit = "bytes" | "count" | "duration";

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

const achievementDefinitionsById = new Map<string, AchievementDefinition>(
  achievementDefinitions.map((definition) => [definition.id, definition]),
);

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

/** Progress toward the target, capped at the target, or null while it cannot be measured. */
function getAchievementProgress(
  definition: AchievementDefinition,
  sources: AchievementSources,
): { current: number; target: number } | null {
  const value = readAchievementMetric(definition.metric, sources);
  if (value === null) return null;
  return { current: Math.min(value, definition.target), target: definition.target };
}

function getAchievementUnlockedAt(
  definition: AchievementDefinition,
  records: AchievementRecords | null,
): number | null {
  return records?.unlockedAchievements[definition.id] ?? null;
}

/**
 * Achievements whose targets the current data reaches but that are not unlocked yet. Nothing is
 * earned before the records load, because only they tell which achievements are already unlocked.
 */
function getEarnedAchievementIds(sources: AchievementSources): string[] {
  const { records } = sources;
  if (!records) return [];
  return achievementDefinitions
    .filter((definition) => {
      if (getAchievementUnlockedAt(definition, records) !== null) return false;
      const value = readAchievementMetric(definition.metric, sources);
      return value !== null && value >= definition.target;
    })
    .map((definition) => definition.id);
}

/** Counts unlocked achievements of the current collection; unknown stored IDs are ignored. */
function countUnlockedAchievements(records: AchievementRecords): number {
  return achievementDefinitions.filter(
    (definition) => getAchievementUnlockedAt(definition, records) !== null,
  ).length;
}

function getAchievementDefinition(id: string): AchievementDefinition | undefined {
  return achievementDefinitionsById.get(id);
}

export {
  achievementMetricUnits,
  countUnlockedAchievements,
  getAchievementDefinition,
  getAchievementProgress,
  getAchievementUnlockedAt,
  getEarnedAchievementIds,
};
export type { AchievementMetricUnit, AchievementSources };
