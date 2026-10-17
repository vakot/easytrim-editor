import type { ConfettiIntensity } from "@/components/ui/confetti";

import type { AchievementSoundKind } from "../lib/achievement-sound";
import type { AchievementToastVariant } from "../types/achievement-toast.types";

/**
 * The Galactic Glyphs reveal of a secret achievement, in seconds from the toast's entrance. The
 * title resolves first, then the description, then a final shimmer passes over the whole toast.
 */
const secretRevealTimeline = {
  descriptionResolveDuration: 1.6,
  descriptionResolveStart: 1.9,
  finalShimmerDuration: 0.9,
  highlightDuration: 0.9,
  titleResolveDuration: 1.2,
  titleResolveStart: 0.5,
} as const;

const secretRevealEnd =
  secretRevealTimeline.descriptionResolveStart + secretRevealTimeline.descriptionResolveDuration;

/** How long a finished secret toast stays readable before it closes. */
const SECRET_HOLD_MS = 2_500;

type AchievementToastPresentation = {
  confetti: ConfettiIntensity;
  /** How long the toast stays open. A secret toast outlasts its whole reveal. */
  displayMs: number;
  sound: AchievementSoundKind;
};

/** Burst size, sound, and duration of each variant; presentation intensity rises with the tier. */
const achievementToastPresentation = {
  bronze: { confetti: "subtle", displayMs: 4_500, sound: "standard" },
  gold: { confetti: "celebration", displayMs: 5_500, sound: "standard" },
  secret: {
    confetti: "celebration",
    displayMs: Math.round(
      (secretRevealEnd + secretRevealTimeline.finalShimmerDuration) * 1_000 + SECRET_HOLD_MS,
    ),
    sound: "secret",
  },
  silver: { confetti: "normal", displayMs: 5_000, sound: "standard" },
  standard: { confetti: "subtle", displayMs: 4_500, sound: "standard" },
} as const satisfies Record<AchievementToastVariant, AchievementToastPresentation>;

/** How long after one announcement appears the next one appears. */
const ANNOUNCEMENT_GAP_MS = 1_500;
const ACHIEVEMENT_TOASTER_ID = "achievement-toasts";

export {
  ACHIEVEMENT_TOASTER_ID,
  achievementToastPresentation,
  ANNOUNCEMENT_GAP_MS,
  secretRevealEnd,
  secretRevealTimeline,
};
