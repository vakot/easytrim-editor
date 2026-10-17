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
  /** An unlock toast's border; its surface tint is `toastSurface`. */
  toast: string;
  /** An unlock toast's tint, drawn over the popover surface. */
  toastSurface: string;
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
    toast: "border-achievement-bronze/60",
    toastSurface: "bg-achievement-bronze/15",
  },
  gold: {
    accent: "text-achievement-gold",
    badge: "border-achievement-gold/40 bg-achievement-gold/10 text-achievement-gold",
    card: "border-achievement-gold/40 bg-achievement-gold/5",
    chip: "border-achievement-gold/60 bg-achievement-gold/10 text-achievement-gold",
    chipLocked: "border-dashed text-muted-foreground [&>svg]:text-achievement-gold/50",
    medallion: "bg-achievement-gold/15 text-achievement-gold ring-achievement-gold/30",
    toast: "border-achievement-gold/60",
    toastSurface: "bg-achievement-gold/15",
  },
  silver: {
    accent: "text-achievement-silver",
    badge: "border-achievement-silver/40 bg-achievement-silver/10 text-achievement-silver",
    card: "border-achievement-silver/40 bg-achievement-silver/5",
    chip: "border-achievement-silver/60 bg-achievement-silver/10 text-achievement-silver",
    chipLocked: "border-dashed text-muted-foreground [&>svg]:text-achievement-silver/50",
    medallion: "bg-achievement-silver/15 text-achievement-silver ring-achievement-silver/30",
    toast: "border-achievement-silver/60",
    toastSurface: "bg-achievement-silver/15",
  },
} as const satisfies Record<AchievementTier, AchievementTierClassNames>;

export { achievementTierClassNames };
