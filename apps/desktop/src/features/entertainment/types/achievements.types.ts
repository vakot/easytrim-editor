import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";

type AchievementCategory =
  "export-milestones" | "export-specialization" | "processing-milestones" | "secret-discoveries";

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

/** An achievement unlocks once the value of its metric reaches its target. */
type AchievementDefinition = {
  category: AchievementCategory;
  description: (t: TFunction) => string;
  icon: LucideIcon;
  /** Stable identifier persisted with the unlock; never rename an existing one. */
  id: string;
  metric: AchievementMetric;
  /** Hides the title, description, unlock condition, and progress until unlocked. */
  secret?: boolean;
  target: number;
  title: (t: TFunction) => string;
};

export type { AchievementCategory, AchievementDefinition, AchievementMetric };
