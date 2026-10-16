import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";

type AchievementCategory = "export-milestones" | "processing-milestones" | "secret-discoveries";

/** A measurable quantity that achievement progress is read from. */
type AchievementMetric =
  | "audioExports"
  | "completedExports"
  | "gifExports"
  | "legendarySplashMessages"
  | "losslessExports"
  | "processingMillis"
  | "sourceBytes"
  | "storageSavedBytes";

type AchievementTier = "bronze" | "gold" | "silver";

type AchievementCopy = {
  description: (t: TFunction) => string;
  title: (t: TFunction) => string;
};

/**
 * A milestone series: Bronze, Silver, and Gold tiers of one metric. Each tier is unlocked on its
 * own, with the identifier `<series id>-<tier>`.
 */
type AchievementSeriesDefinition = AchievementCopy & {
  category: AchievementCategory;
  icon: LucideIcon;
  /** Stable identifier; its tier identifiers are persisted with each unlock. */
  id: string;
  kind: "series";
  metric: AchievementMetric;
  /** The metric value that unlocks each tier, ascending from Bronze to Gold. */
  thresholds: Readonly<Record<AchievementTier, number>>;
};

/** An achievement that unlocks once, outside any milestone series. */
type StandaloneAchievementDefinition = AchievementCopy & {
  category: AchievementCategory;
  icon: LucideIcon;
  /** Stable identifier persisted with the unlock; never rename an existing one. */
  id: string;
  kind: "standalone";
  metric: AchievementMetric;
  /** Hides the title, description, unlock condition, and progress until unlocked. */
  secret?: boolean;
  target: number;
};

/** One card of the collection. */
type AchievementCollectionEntry = AchievementSeriesDefinition | StandaloneAchievementDefinition;

/** One independently unlockable achievement: a series tier or a standalone achievement. */
type UnlockableAchievement =
  | {
      entry: AchievementSeriesDefinition;
      id: string;
      metric: AchievementMetric;
      target: number;
      tier: AchievementTier;
    }
  | {
      entry: StandaloneAchievementDefinition;
      id: string;
      metric: AchievementMetric;
      target: number;
      tier: null;
    };

export type {
  AchievementCategory,
  AchievementCollectionEntry,
  AchievementMetric,
  AchievementSeriesDefinition,
  AchievementTier,
  StandaloneAchievementDefinition,
  UnlockableAchievement,
};
