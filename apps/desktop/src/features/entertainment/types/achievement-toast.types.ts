import type { AchievementToastContent } from "@easytrim-editor/ui/achievement-unlock-toast";

/**
 * One unlocked achievement waiting to be celebrated: the toast's localized content and the
 * achievement it belongs to.
 */
type AchievementAnnouncement = AchievementToastContent & { achievementId: string };

export type { AchievementAnnouncement };
