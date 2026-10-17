import type { LucideIcon } from "lucide-react";

import type { AchievementTier } from "./achievements.types";

/** Which celebration an unlocked achievement gets; each variant has its own look and intensity. */
type AchievementToastVariant = "standard" | AchievementTier | "secret";

/**
 * Everything one achievement's toast shows, already localized and independent of how it is
 * presented, so the same announcement renders in the app, in stories, and in tests.
 */
type AchievementAnnouncement = {
  achievementId: string;
  description: string;
  icon: LucideIcon;
  /** The tier to show, or null for a standalone achievement. */
  tier: AchievementTier | null;
  tierLabel: string | null;
  title: string;
  /** The caption above the title, such as "Achievement unlocked". */
  unlockedLabel: string;
  variant: AchievementToastVariant;
};

export type { AchievementAnnouncement, AchievementToastVariant };
