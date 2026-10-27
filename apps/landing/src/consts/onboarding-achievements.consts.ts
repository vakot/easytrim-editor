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
 * The toast loop's pace, in milliseconds: how long each toast leads before the next one arrives,
 * and how long the previous one takes to fade out beneath it.
 */
const onboardingLoopTiming = {
  exitMs: 400,
  toastMs: 3_000,
} as const;

export { onboardingAchievements, onboardingLoopTiming };
