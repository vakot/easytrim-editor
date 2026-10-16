import type { AchievementRecords } from "@/domain/achievement-records";

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
      "the-chosen-one",
      "bronze-collector",
      "silver-collector",
      "gold-collector",
    ].map((id) => [id, unlockedAt]),
  ),
  viewedAtMillis: null,
};
