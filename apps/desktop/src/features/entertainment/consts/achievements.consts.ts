import type { TFunction } from "i18next";
import {
  Award,
  Crown,
  HardDrive,
  Headphones,
  Hourglass,
  ImagePlay,
  Medal,
  PiggyBank,
  Rocket,
  Scissors,
  Trophy,
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

/**
 * The tiers of the seven original milestone series. A collector requires exactly these literal
 * identifiers and nothing else, so series added later never change what a collector asks for.
 * Never edit these lists after release; introduce a new collector for a larger set instead.
 */
const originalBronzeTierIds = [
  "export-mastery-bronze",
  "lossless-precision-bronze",
  "gif-creator-bronze",
  "audio-specialist-bronze",
  "time-well-spent-bronze",
  "data-cruncher-bronze",
  "storage-saver-bronze",
] as const;

const originalSilverTierIds = [
  "export-mastery-silver",
  "lossless-precision-silver",
  "gif-creator-silver",
  "audio-specialist-silver",
  "time-well-spent-silver",
  "data-cruncher-silver",
  "storage-saver-silver",
] as const;

const originalGoldTierIds = [
  "export-mastery-gold",
  "lossless-precision-gold",
  "gif-creator-gold",
  "audio-specialist-gold",
  "time-well-spent-gold",
  "data-cruncher-gold",
  "storage-saver-gold",
] as const;

/** The category order of the collection. */
const achievementCategories = [
  "export-milestones",
  "processing-milestones",
  "secret-discoveries",
] as const satisfies readonly AchievementCategory[];

/** Tiers in ascending order. */
const achievementTiers = ["bronze", "silver", "gold"] as const satisfies readonly AchievementTier[];

const legendarySplashMessageIds = splashMessagesLegendary.map((message) => message.id);

/**
 * The achievement catalog. Rules that keep it compatible with saved progress:
 *
 * - Identifiers are permanent: never rename, reuse, or repurpose one. Titles, descriptions, icons,
 *   and styling may change freely because they are not persisted.
 * - Thresholds may change without migration. Lowering one unlocks the achievement retroactively;
 *   raising one never revokes an unlock, because unlocks are stored, not recomputed.
 * - New achievements are evaluated against all stored history when they ship.
 * - A removed achievement stays in the persisted records; only the active catalog forgets it.
 * - Renaming a stored identifier needs an explicit migration in the native records decoder.
 * - A collection condition lists its requirements explicitly and never grows with the registry.
 */
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
    condition: { ids: legendarySplashMessageIds, kind: "discovery" },
    description: (t: TFunction) => t("achievements.items.theChosenOne.description"),
    icon: Crown,
    id: "the-chosen-one",
    kind: "standalone",
    secret: true,
    title: (t: TFunction) => t("achievements.items.theChosenOne.title"),
  },
  {
    category: "secret-discoveries",
    condition: { kind: "collection", requires: originalBronzeTierIds },
    description: (t: TFunction) => t("achievements.items.bronzeCollector.description"),
    icon: Medal,
    id: "bronze-collector",
    kind: "standalone",
    secret: true,
    title: (t: TFunction) => t("achievements.items.bronzeCollector.title"),
  },
  {
    category: "secret-discoveries",
    condition: { kind: "collection", requires: originalSilverTierIds },
    description: (t: TFunction) => t("achievements.items.silverCollector.description"),
    icon: Award,
    id: "silver-collector",
    kind: "standalone",
    secret: true,
    title: (t: TFunction) => t("achievements.items.silverCollector.title"),
  },
  {
    category: "secret-discoveries",
    condition: { kind: "collection", requires: originalGoldTierIds },
    description: (t: TFunction) => t("achievements.items.goldCollector.description"),
    icon: Trophy,
    id: "gold-collector",
    kind: "standalone",
    secret: true,
    title: (t: TFunction) => t("achievements.items.goldCollector.title"),
  },
] as const satisfies readonly AchievementCollectionEntry[];

export { achievementCategories, achievementCollection, achievementTiers };
