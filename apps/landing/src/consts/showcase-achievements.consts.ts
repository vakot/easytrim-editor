import { Crown, Headphones, ImagePlay, PiggyBank, Scissors } from "lucide-react";

import type {
  AchievementToastContent,
  AchievementToastVariant,
} from "@easytrim-editor/ui/achievement-unlock-toast";

const unlockedLabel = "Achievement unlocked";

/** Real achievements from the application's collection, one for each unlock celebration. */
const showcaseAchievements = {
  standard: {
    description: "Use Trim to make a meaningful selection",
    icon: Scissors,
    tier: null,
    tierLabel: null,
    title: "Cut to the Chase",
    unlockedLabel,
    variant: "standard",
  },
  bronze: {
    description: "Export animated GIFs",
    icon: ImagePlay,
    tier: "bronze",
    tierLabel: "Bronze",
    title: "GIF Creator",
    unlockedLabel,
    variant: "bronze",
  },
  silver: {
    description: "Complete audio-only exports",
    icon: Headphones,
    tier: "silver",
    tierLabel: "Silver",
    title: "Audio Specialist",
    unlockedLabel,
    variant: "silver",
  },
  gold: {
    description: "Save storage by exporting files smaller than their sources",
    icon: PiggyBank,
    tier: "gold",
    tierLabel: "Gold",
    title: "Storage Saver",
    unlockedLabel,
    variant: "gold",
  },
  secret: {
    description: "Encounter every legendary splash message",
    icon: Crown,
    tier: null,
    tierLabel: null,
    title: "The Chosen One",
    unlockedLabel,
    variant: "secret",
  },
} as const satisfies Record<AchievementToastVariant, AchievementToastContent>;

/** The variants in ascending celebration intensity, as the picker lists them. */
const showcaseVariants = [
  { label: "Standard", variant: "standard" },
  { label: "Bronze", variant: "bronze" },
  { label: "Silver", variant: "silver" },
  { label: "Gold", variant: "gold" },
  { label: "Secret", variant: "secret" },
] as const satisfies readonly { label: string; variant: AchievementToastVariant }[];

/** What a locked secret shows in its place, as in the application. */
const concealedSecret = {
  description: "A secret achievement. Keep exploring to reveal it",
  title: "???",
} as const;

export { concealedSecret, showcaseAchievements, showcaseVariants };
