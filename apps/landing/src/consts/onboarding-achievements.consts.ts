import { AudioLines, Crop, Handshake, Keyboard, ListPlus, Scissors } from "lucide-react";

import type { AchievementToastContent } from "@easytrim-editor/ui/achievement-unlock-toast";

type OnboardingAchievement = AchievementToastContent & { id: string };

const unlockedLabel = "Achievement unlocked";

/** The application's Getting Started achievements, in the order a first edit tends to earn them. */
const onboardingAchievements: readonly OnboardingAchievement[] = [
  {
    description: "Import a media file for the first time",
    icon: Handshake,
    id: "first-contact",
    tier: null,
    tierLabel: null,
    title: "First Contact",
    unlockedLabel,
    variant: "standard",
  },
  {
    description: "Use Trim to make a meaningful selection",
    icon: Scissors,
    id: "cut-to-the-chase",
    tier: null,
    tierLabel: null,
    title: "Cut to the Chase",
    unlockedLabel,
    variant: "standard",
  },
  {
    description: "Crop the frame to a new size",
    icon: Crop,
    id: "frame-by-frame",
    tier: null,
    tierLabel: null,
    title: "Frame by Frame",
    unlockedLabel,
    variant: "standard",
  },
  {
    description: "Apply an audio filter or another media adjustment",
    icon: AudioLines,
    id: "fine-tuning",
    tier: null,
    tierLabel: null,
    title: "Fine Tuning",
    unlockedLabel,
    variant: "standard",
  },
  {
    description: "Add an export to the Export Queue",
    icon: ListPlus,
    id: "queued-up",
    tier: null,
    tierLabel: null,
    title: "Queued Up",
    unlockedLabel,
    variant: "standard",
  },
  {
    description: "Use a timeline keyboard shortcut that changes your edit",
    icon: Keyboard,
    id: "shortcut-taken",
    tier: null,
    tierLabel: null,
    title: "Shortcut Taken",
    unlockedLabel,
    variant: "standard",
  },
];

/**
 * How long each step of the onboarding loop stays on screen, in milliseconds: the fresh collection,
 * every unlock, and the completion celebration before the loop starts over.
 */
const onboardingLoopTiming = {
  completionMs: 3_200,
  startMs: 1_200,
  unlockMs: 2_400,
} as const;

export { onboardingAchievements, onboardingLoopTiming };
