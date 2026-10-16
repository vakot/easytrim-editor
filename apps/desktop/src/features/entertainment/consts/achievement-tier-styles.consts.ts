import type { AchievementTier } from "../types/achievements.types";

/** Theme-aware Bronze, Silver, and Gold treatments shared by cards and notifications. */
const achievementTierClassNames = {
  bronze: {
    accent: "text-achievement-bronze",
    badge: "border-achievement-bronze/40 bg-achievement-bronze/10 text-achievement-bronze",
    medallion: "bg-achievement-bronze/15 text-achievement-bronze ring-achievement-bronze/30",
  },
  gold: {
    accent: "text-achievement-gold",
    badge: "border-achievement-gold/40 bg-achievement-gold/10 text-achievement-gold",
    medallion: "bg-achievement-gold/15 text-achievement-gold ring-achievement-gold/30",
  },
  silver: {
    accent: "text-achievement-silver",
    badge: "border-achievement-silver/40 bg-achievement-silver/10 text-achievement-silver",
    medallion: "bg-achievement-silver/15 text-achievement-silver ring-achievement-silver/30",
  },
} as const satisfies Record<AchievementTier, { accent: string; badge: string; medallion: string }>;

export { achievementTierClassNames };
