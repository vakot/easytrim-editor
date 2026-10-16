import type { AchievementRecords } from "@/domain/achievement-records";

export const emptyAchievementRecords: AchievementRecords = {
  discoveredSplashMessageIds: [],
  unlockedAchievements: {},
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

/** Every tier of every series and every standalone achievement, unlocked. */
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
    ].map((id) => [id, unlockedAt]),
  ),
};
