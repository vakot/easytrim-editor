import type { AchievementRecords } from "@/domain/achievement-records";
import type { UsageStatistics } from "@/domain/usage-statistics";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

export const emptyAchievementRecords: AchievementRecords = {
  discoveredSplashMessageIds: [],
  unlockedAchievements: {},
  viewedAtMillis: null,
};

const unlockedAt = Date.UTC(2026, 9, 12, 18, 30);

const seriesIds = [
  "audio-specialist",
  "data-cruncher",
  "export-mastery",
  "gif-creator",
  "lossless-precision",
  "storage-saver",
  "time-well-spent",
];

/** Every tier of every series and every standalone achievement, collectors included, unlocked. */
export const completeAchievementRecords: AchievementRecords = {
  discoveredSplashMessageIds: [
    "chosen-frame",
    "corrupted-signal",
    "enchantment-table",
    "frame-not-found",
    "rainbow-mode",
  ],
  unlockedAchievements: Object.fromEntries(
    [
      ...seriesIds.flatMap((id) => [`${id}-bronze`, `${id}-silver`, `${id}-gold`]),
      "first-contact",
      "cut-to-the-chase",
      "frame-by-frame",
      "fine-tuning",
      "queued-up",
      "shortcut-taken",
      "the-chosen-one",
      "bronze-collector",
      "silver-collector",
      "gold-collector",
    ].map((id) => [id, unlockedAt]),
  ),
  viewedAtMillis: null,
};

/** All but the timeline shortcut Getting Started task have been completed. */
export const almostCompleteGettingStartedRecords: AchievementRecords = {
  ...completeAchievementRecords,
  unlockedAchievements: Object.fromEntries(
    Object.entries(completeAchievementRecords.unlockedAchievements).filter(
      ([id]) => id !== "shortcut-taken",
    ),
  ),
};

/**
 * Statistics and records of a partially completed collection. The two agree: every tier whose
 * threshold the statistics reach is unlocked, which the achievements tests verify with the real
 * evaluation instead of trusting this list.
 */
export const partiallyUnlockedAchievementScenario: {
  records: AchievementRecords;
  statistics: UsageStatistics;
} = {
  records: {
    discoveredSplashMessageIds: ["rainbow-mode", "chosen-frame"],
    unlockedAchievements: {
      "first-contact": Date.UTC(2026, 0, 15, 12),
      "data-cruncher-bronze": Date.UTC(2026, 1, 3, 9),
      "export-mastery-bronze": Date.UTC(2026, 0, 15, 12),
      "export-mastery-silver": Date.UTC(2026, 1, 3, 9),
      "gif-creator-bronze": Date.UTC(2026, 3, 22, 17),
      "lossless-precision-bronze": Date.UTC(2026, 0, 15, 12),
      "lossless-precision-gold": Date.UTC(2026, 8, 30, 20),
      "lossless-precision-silver": Date.UTC(2026, 2, 1, 10),
      "time-well-spent-bronze": Date.UTC(2026, 0, 15, 12),
      "time-well-spent-silver": Date.UTC(2026, 4, 9, 20),
    },
    // Viewed in April: the later unlocks are marked new.
    viewedAtMillis: Date.UTC(2026, 3, 1),
  },
  statistics: {
    ...emptyUsageStatistics,
    gifExports: 3,
    losslessExports: 52,
    optimizedExports: 16,
    outputBytes: 3 * 1_024 ** 3,
    processingMillis: 41 * 60_000,
    sourceBytes: 3 * 1_024 ** 3 + 60 * 1_024 ** 2,
  },
};

/** Statistics that reach every Gold tier, matching `completeAchievementRecords`. */
export const completeAchievementStatistics: UsageStatistics = {
  ...emptyUsageStatistics,
  audioExports: 31,
  gifExports: 28,
  losslessExports: 64,
  optimizedExports: 60,
  outputBytes: 120 * 1_024 ** 3,
  processingMillis: 95 * 60_000,
  sourceBytes: 132 * 1_024 ** 3,
};
