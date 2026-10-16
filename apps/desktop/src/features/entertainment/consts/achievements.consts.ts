import type { TFunction } from "i18next";
import {
  Crown,
  HardDrive,
  Headphones,
  Hourglass,
  ImagePlay,
  PiggyBank,
  Rocket,
  Scissors,
} from "lucide-react";

import type {
  AchievementCategory,
  AchievementCollectionEntry,
  AchievementTier,
} from "../types/achievements.types";

import { splashMessagesLegendary } from "./splash-messages.consts";

const MINUTE_MILLIS = 60_000;
const MEGABYTE = 1_024 ** 2;
const GIGABYTE = 1_024 ** 3;

/** The category order of the collection. */
const achievementCategories = [
  "export-milestones",
  "processing-milestones",
  "secret-discoveries",
] as const satisfies readonly AchievementCategory[];

/** Tiers in ascending order. */
const achievementTiers = ["bronze", "silver", "gold"] as const satisfies readonly AchievementTier[];

const achievementCollection = [
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.exportMastery.description"),
    icon: Rocket,
    id: "export-mastery",
    kind: "series",
    metric: "completedExports",
    thresholds: { bronze: 1, silver: 10, gold: 100 },
    title: (t: TFunction) => t("achievements.items.exportMastery.title"),
  },
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.losslessPrecision.description"),
    icon: Scissors,
    id: "lossless-precision",
    kind: "series",
    metric: "losslessExports",
    thresholds: { bronze: 1, silver: 10, gold: 50 },
    title: (t: TFunction) => t("achievements.items.losslessPrecision.title"),
  },
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.gifCreator.description"),
    icon: ImagePlay,
    id: "gif-creator",
    kind: "series",
    metric: "gifExports",
    thresholds: { bronze: 1, silver: 5, gold: 25 },
    title: (t: TFunction) => t("achievements.items.gifCreator.title"),
  },
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.audioSpecialist.description"),
    icon: Headphones,
    id: "audio-specialist",
    kind: "series",
    metric: "audioExports",
    thresholds: { bronze: 1, silver: 5, gold: 25 },
    title: (t: TFunction) => t("achievements.items.audioSpecialist.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.timeWellSpent.description"),
    icon: Hourglass,
    id: "time-well-spent",
    kind: "series",
    metric: "processingMillis",
    thresholds: { bronze: MINUTE_MILLIS, silver: 10 * MINUTE_MILLIS, gold: 60 * MINUTE_MILLIS },
    title: (t: TFunction) => t("achievements.items.timeWellSpent.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.dataCruncher.description"),
    icon: HardDrive,
    id: "data-cruncher",
    kind: "series",
    metric: "sourceBytes",
    thresholds: { bronze: GIGABYTE, silver: 10 * GIGABYTE, gold: 100 * GIGABYTE },
    title: (t: TFunction) => t("achievements.items.dataCruncher.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.storageSaver.description"),
    icon: PiggyBank,
    id: "storage-saver",
    kind: "series",
    metric: "storageSavedBytes",
    thresholds: { bronze: 100 * MEGABYTE, silver: GIGABYTE, gold: 10 * GIGABYTE },
    title: (t: TFunction) => t("achievements.items.storageSaver.title"),
  },
  {
    category: "secret-discoveries",
    description: (t: TFunction) => t("achievements.items.theChosenOne.description"),
    icon: Crown,
    id: "the-chosen-one",
    kind: "standalone",
    metric: "legendarySplashMessages",
    secret: true,
    target: splashMessagesLegendary.length,
    title: (t: TFunction) => t("achievements.items.theChosenOne.title"),
  },
] as const satisfies readonly AchievementCollectionEntry[];

export { achievementCategories, achievementCollection, achievementTiers };
