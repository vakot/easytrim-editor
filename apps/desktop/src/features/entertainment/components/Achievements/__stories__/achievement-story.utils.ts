import type { AchievementRecords } from "@/domain/achievement-records";
import type { UsageStatistics } from "@/domain/usage-statistics";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";

import { getEarnedAchievementIds } from "../../../lib/achievements.utils";

type DeriveAchievementRecordsOptions = {
  discoveredSplashMessageIds?: string[];
  /** When each earned achievement was unlocked; defaults to one day apart in earning order. */
  unlockedAt?: (id: string, index: number) => number;
  viewedAtMillis?: number | null;
};

/**
 * Records that agree with `statistics`: every achievement the application's own evaluation would
 * unlock is unlocked, tiers and the collectors they complete included. Stories derive their records
 * here so they cannot show progress at a threshold with the matching tier still locked.
 */
function deriveAchievementRecords(
  statistics: UsageStatistics,
  {
    discoveredSplashMessageIds = [],
    unlockedAt = (_id, index) => Date.UTC(2026, 0, 2 + index, 12),
    viewedAtMillis = Date.UTC(2026, 9, 1),
  }: DeriveAchievementRecordsOptions = {},
): AchievementRecords {
  const seed: AchievementRecords = {
    ...emptyAchievementRecords,
    discoveredSplashMessageIds,
    viewedAtMillis,
  };

  const earned = getEarnedAchievementIds({ records: seed, statistics });

  return {
    ...seed,
    unlockedAchievements: Object.fromEntries(
      earned.map((id, index) => [id, unlockedAt(id, index)]),
    ),
  };
}

export { deriveAchievementRecords };
