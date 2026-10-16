import type { AchievementRecords } from "@/domain/achievement-records";

export const emptyAchievementRecords: AchievementRecords = {
  discoveredSplashMessageIds: [],
  unlockedAchievements: {},
};

const unlockedAt = Date.UTC(2026, 9, 12, 18, 30);

/** Every achievement of the initial collection, unlocked. */
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
      "audio-specialist",
      "data-cruncher",
      "export-legend",
      "export-veteran",
      "first-export",
      "first-lossless-cut",
      "getting-started",
      "gif-maker",
      "lossless-legend",
      "one-hour-later",
      "storage-saver",
      "the-chosen-one",
      "working-overtime",
    ].map((id) => [id, unlockedAt]),
  ),
};
