import type { AchievementTier } from "../types/achievements.types";

type AchievementTierClassNames = {
  /** Tier-colored foreground, such as a notification icon. */
  accent: string;
  /** The current-tier badge. */
  badge: string;
  /** A card whose highest unlocked tier this is: a tier border and a subtle tint. */
  card: string;
  /** An unlocked tier chip: full tier color with a matching border. */
  chip: string;
  /** A locked tier chip: a dimmed tier medal on a neutral dashed border. */
  chipLocked: string;
  /** The card's primary icon. */
  medallion: string;
};

/** Theme-aware Bronze, Silver, and Gold treatments shared by cards and notifications. */
const achievementTierClassNames = {
  bronze: {
    accent: "text-achievement-bronze",
    badge: "border-achievement-bronze/40 bg-achievement-bronze/10 text-achievement-bronze",
    card: "border-achievement-bronze/40 bg-achievement-bronze/5",
    chip: "border-achievement-bronze/60 bg-achievement-bronze/10 text-achievement-bronze",
    chipLocked: "border-dashed text-muted-foreground [&>svg]:text-achievement-bronze/50",
    medallion: "bg-achievement-bronze/15 text-achievement-bronze ring-achievement-bronze/30",
  },
  gold: {
    accent: "text-achievement-gold",
    badge: "border-achievement-gold/40 bg-achievement-gold/10 text-achievement-gold",
    card: "border-achievement-gold/40 bg-achievement-gold/5",
    chip: "border-achievement-gold/60 bg-achievement-gold/10 text-achievement-gold",
    chipLocked: "border-dashed text-muted-foreground [&>svg]:text-achievement-gold/50",
    medallion: "bg-achievement-gold/15 text-achievement-gold ring-achievement-gold/30",
  },
  silver: {
    accent: "text-achievement-silver",
    badge: "border-achievement-silver/40 bg-achievement-silver/10 text-achievement-silver",
    card: "border-achievement-silver/40 bg-achievement-silver/5",
    chip: "border-achievement-silver/60 bg-achievement-silver/10 text-achievement-silver",
    chipLocked: "border-dashed text-muted-foreground [&>svg]:text-achievement-silver/50",
    medallion: "bg-achievement-silver/15 text-achievement-silver ring-achievement-silver/30",
  },
} as const satisfies Record<AchievementTier, AchievementTierClassNames>;

/**
 * The treatment of an unlocked secret achievement: a restrained gradient through all three tier
 * colors on the card and its icon. A locked secret keeps the neutral locked styling.
 */
const achievementSecretClassNames = {
  card: "border-achievement-gold/40 bg-linear-to-br from-achievement-bronze/10 via-achievement-silver/10 to-achievement-gold/15",
  medallion:
    "bg-linear-to-br from-achievement-bronze/25 via-achievement-silver/25 to-achievement-gold/30 text-achievement-gold ring-achievement-gold/30",
} as const;

export { achievementSecretClassNames, achievementTierClassNames };
