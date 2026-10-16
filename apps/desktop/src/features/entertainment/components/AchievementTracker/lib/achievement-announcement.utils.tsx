import type { TFunction } from "i18next";
import { type LucideIcon, Trophy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/class-names.utils";

import { achievementTierClassNames } from "../../../consts/achievement-tier-styles.consts";
import {
  compareAchievementTiers,
  getAchievementTierLabel,
  getUnlockableAchievement,
} from "../../../lib/achievements.utils";
import type { AchievementTier, UnlockableAchievement } from "../../../types/achievements.types";

/**
 * What to announce for achievements unlocked together, independent of how it is presented, so a
 * custom notification can render the same announcement.
 */
type AchievementAnnouncement = {
  /** Every achievement the announcement covers, including lower tiers unlocked alongside. */
  achievementIds: string[];
  description: string;
  icon: LucideIcon;
  /** The tier to present, or null for a standalone achievement or a summary of several. */
  tier: AchievementTier | null;
  title: string;
};

/**
 * Combines achievements unlocked together into one announcement. Tiers of one series collapse to
 * the highest one; unlocks across several series or standalone achievements become one summary.
 */
function createAchievementAnnouncement(
  achievementIds: readonly string[],
  t: TFunction,
): AchievementAnnouncement | null {
  const achievements = achievementIds.flatMap((id) => getUnlockableAchievement(id) ?? []);
  const highestByEntry = new Map<string, UnlockableAchievement>();
  for (const achievement of achievements) {
    const highest = highestByEntry.get(achievement.entry.id);
    if (
      !highest ||
      (achievement.tier &&
        highest.tier &&
        compareAchievementTiers(achievement.tier, highest.tier) > 0)
    ) {
      highestByEntry.set(achievement.entry.id, achievement);
    }
  }
  const announced = [...highestByEntry.values()];
  const [first] = announced;
  if (!first) return null;
  const ids = achievements.map((achievement) => achievement.id);

  if (announced.length === 1) {
    return {
      achievementIds: ids,
      description: first.tier
        ? t("achievements.notification.tierUnlocked", {
            tier: getAchievementTierLabel(first.tier, t),
          })
        : t("achievements.notification.unlocked"),
      icon: first.entry.icon,
      tier: first.tier,
      title: first.entry.title(t),
    };
  }

  return {
    achievementIds: ids,
    description: announced
      .map((achievement) =>
        achievement.tier
          ? t("achievements.notification.seriesTier", {
              series: achievement.entry.title(t),
              tier: getAchievementTierLabel(achievement.tier, t),
            })
          : achievement.entry.title(t),
      )
      .join(", "),
    icon: Trophy,
    tier: null,
    title: t("achievements.notification.unlockedMany", { count: ids.length }),
  };
}

/** Presents an announcement as a toast. Toasts never take focus, so nothing is interrupted. */
function showAchievementAnnouncement(announcement: AchievementAnnouncement): void {
  const Icon = announcement.icon;
  toast(announcement.title, {
    description: announcement.description,
    icon: (
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4",
          announcement.tier ? achievementTierClassNames[announcement.tier].accent : "text-primary",
        )}
      />
    ),
    id: `achievement-unlocked:${announcement.achievementIds.join(",")}`,
  });
}

export { createAchievementAnnouncement, showAchievementAnnouncement };
export type { AchievementAnnouncement };
