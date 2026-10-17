import type { TFunction } from "i18next";

import type {
  AchievementAnnouncement,
  AchievementToastVariant,
} from "../types/achievement-toast.types";
import type { UnlockableAchievement } from "../types/achievements.types";

import { getAchievementTierLabel, getUnlockableAchievement } from "./achievements.utils";

/**
 * The celebration an achievement gets: its tier for a series, the secret treatment for a secret
 * standalone achievement, and the standard one for any other.
 */
function getAchievementToastVariant(achievement: UnlockableAchievement): AchievementToastVariant {
  if (achievement.tier) return achievement.tier;
  return achievement.entry.secret ? "secret" : "standard";
}

function createAnnouncement(
  achievement: UnlockableAchievement,
  t: TFunction,
): AchievementAnnouncement {
  const { entry, tier } = achievement;
  return {
    achievementId: achievement.id,
    description: entry.description(t),
    icon: entry.icon,
    tier,
    tierLabel: tier ? getAchievementTierLabel(tier, t) : null,
    title: entry.title(t),
    unlockedLabel: t("achievements.notification.unlocked"),
    variant: getAchievementToastVariant(achievement),
  };
}

/**
 * One announcement for every unlocked achievement, in the order they unlocked. Achievements are
 * never combined: each tier, collector, and standalone achievement keeps its own announcement.
 * Unknown identifiers, such as retired achievements, are skipped.
 */
function createAchievementAnnouncements(
  achievementIds: readonly string[],
  t: TFunction,
): AchievementAnnouncement[] {
  return achievementIds.flatMap((id) => {
    const achievement = getUnlockableAchievement(id);
    return achievement ? [createAnnouncement(achievement, t)] : [];
  });
}

export { createAchievementAnnouncements, getAchievementToastVariant };
