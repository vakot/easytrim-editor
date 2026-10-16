import type { TFunction } from "i18next";
import {
  Coffee,
  Crown,
  Footprints,
  Gem,
  HardDrive,
  Headphones,
  Hourglass,
  ImagePlay,
  Medal,
  PartyPopper,
  PiggyBank,
  Rocket,
  Scissors,
} from "lucide-react";

import type { AchievementCategory, AchievementDefinition } from "../types/achievements.types";

import { splashMessagesLegendary } from "./splash-messages.consts";

const HOUR_MILLIS = 3_600_000;
const GIGABYTE = 1_024 ** 3;

/** The category order of the collection. */
const achievementCategories = [
  "export-milestones",
  "export-specialization",
  "processing-milestones",
  "secret-discoveries",
] as const satisfies readonly AchievementCategory[];

const achievementDefinitions = [
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.firstExport.description"),
    icon: PartyPopper,
    id: "first-export",
    metric: "completedExports",
    target: 1,
    title: (t: TFunction) => t("achievements.items.firstExport.title"),
  },
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.gettingStarted.description"),
    icon: Footprints,
    id: "getting-started",
    metric: "completedExports",
    target: 10,
    title: (t: TFunction) => t("achievements.items.gettingStarted.title"),
  },
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.exportVeteran.description"),
    icon: Medal,
    id: "export-veteran",
    metric: "completedExports",
    target: 100,
    title: (t: TFunction) => t("achievements.items.exportVeteran.title"),
  },
  {
    category: "export-milestones",
    description: (t: TFunction) => t("achievements.items.exportLegend.description"),
    icon: Rocket,
    id: "export-legend",
    metric: "completedExports",
    target: 1_000,
    title: (t: TFunction) => t("achievements.items.exportLegend.title"),
  },
  {
    category: "export-specialization",
    description: (t: TFunction) => t("achievements.items.firstLosslessCut.description"),
    icon: Scissors,
    id: "first-lossless-cut",
    metric: "losslessExports",
    target: 1,
    title: (t: TFunction) => t("achievements.items.firstLosslessCut.title"),
  },
  {
    category: "export-specialization",
    description: (t: TFunction) => t("achievements.items.losslessLegend.description"),
    icon: Gem,
    id: "lossless-legend",
    metric: "losslessExports",
    target: 100,
    title: (t: TFunction) => t("achievements.items.losslessLegend.title"),
  },
  {
    category: "export-specialization",
    description: (t: TFunction) => t("achievements.items.gifMaker.description"),
    icon: ImagePlay,
    id: "gif-maker",
    metric: "gifExports",
    target: 1,
    title: (t: TFunction) => t("achievements.items.gifMaker.title"),
  },
  {
    category: "export-specialization",
    description: (t: TFunction) => t("achievements.items.audioSpecialist.description"),
    icon: Headphones,
    id: "audio-specialist",
    metric: "audioExports",
    target: 10,
    title: (t: TFunction) => t("achievements.items.audioSpecialist.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.oneHourLater.description"),
    icon: Hourglass,
    id: "one-hour-later",
    metric: "processingMillis",
    target: HOUR_MILLIS,
    title: (t: TFunction) => t("achievements.items.oneHourLater.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.workingOvertime.description"),
    icon: Coffee,
    id: "working-overtime",
    metric: "processingMillis",
    target: 24 * HOUR_MILLIS,
    title: (t: TFunction) => t("achievements.items.workingOvertime.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.dataCruncher.description"),
    icon: HardDrive,
    id: "data-cruncher",
    metric: "sourceBytes",
    target: 100 * GIGABYTE,
    title: (t: TFunction) => t("achievements.items.dataCruncher.title"),
  },
  {
    category: "processing-milestones",
    description: (t: TFunction) => t("achievements.items.storageSaver.description"),
    icon: PiggyBank,
    id: "storage-saver",
    metric: "storageSavedBytes",
    target: 10 * GIGABYTE,
    title: (t: TFunction) => t("achievements.items.storageSaver.title"),
  },
  {
    category: "secret-discoveries",
    description: (t: TFunction) => t("achievements.items.theChosenOne.description"),
    icon: Crown,
    id: "the-chosen-one",
    metric: "legendarySplashMessages",
    secret: true,
    target: splashMessagesLegendary.length,
    title: (t: TFunction) => t("achievements.items.theChosenOne.title"),
  },
] as const satisfies readonly AchievementDefinition[];

export { achievementCategories, achievementDefinitions };
