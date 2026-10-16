import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";

type AchievementCategory =
  "export-milestones" | "getting-started" | "processing-milestones" | "secret-discoveries";

/** A measurable quantity that achievement progress is read from usage statistics. */
type AchievementMetric =
  | "audioExports"
  | "completedExports"
  | "gifExports"
  | "losslessExports"
  | "processingMillis"
  | "sourceBytes"
  | "storageSavedBytes";

type AchievementTier = "bronze" | "gold" | "silver";

/**
 * What unlocks an achievement. Conditions are declarative and only ever read data that persists, so
 * evaluating one never depends on what else the registry currently contains.
 */
type AchievementCondition =
  /** A usage statistics metric reaches a target. */
  | { kind: "metric"; metric: AchievementMetric; target: number }
  /** Every one of these unique events was discovered, such as legendary splash messages. */
  | { ids: readonly string[]; kind: "discovery" }
  /** A successful semantic interaction, persisted as an unlock when it occurs. */
  | {
      event:
        | "export-queued"
        | "media-adjustment"
        | "meaningful-trim"
        | "non-default-crop"
        | "timeline-shortcut";
      kind: "event";
    }
  /**
   * Every one of these achievements is unlocked. The list is explicit and fixed: it is never
   * derived from the registry, so adding achievements cannot change what it requires. Retired
   * achievements still count, because their unlocks remain in the records.
   */
  | { kind: "collection"; requires: readonly string[] };

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
  condition: AchievementCondition;
  icon: LucideIcon;
  /** Stable identifier persisted with the unlock; never rename or reuse an existing one. */
  id: string;
  kind: "standalone";
  /** Hides the title, description, unlock condition, and progress until unlocked. */
  secret?: boolean;
};

/** One card of the collection. */
type AchievementCollectionEntry = AchievementSeriesDefinition | StandaloneAchievementDefinition;

/** One independently unlockable achievement: a series tier or a standalone achievement. */
type UnlockableAchievement =
  | {
      condition: AchievementCondition;
      entry: AchievementSeriesDefinition;
      id: string;
      tier: AchievementTier;
    }
  | {
      condition: AchievementCondition;
      entry: StandaloneAchievementDefinition;
      id: string;
      tier: null;
    };

export type {
  AchievementCategory,
  AchievementCollectionEntry,
  AchievementCondition,
  AchievementMetric,
  AchievementSeriesDefinition,
  AchievementTier,
  StandaloneAchievementDefinition,
  UnlockableAchievement,
};
