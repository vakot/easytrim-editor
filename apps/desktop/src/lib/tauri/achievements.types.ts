import type { AchievementRecords } from "@/domain/achievement-records";

interface AchievementUnlockResult {
  records: AchievementRecords;
  /** Achievements this request newly unlocked; already unlocked ones are never repeated. */
  unlockedAchievementIds: string[];
}

export type { AchievementUnlockResult };
