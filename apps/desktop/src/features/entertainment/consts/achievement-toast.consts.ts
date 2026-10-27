import {
  type AchievementToastVariant,
  secretRevealEnd,
  secretRevealTimeline,
} from "@easytrim-editor/ui/achievement-unlock-toast";

import type { AchievementSoundKind } from "../lib/achievement-sound";

/** How long a finished secret toast stays readable before it closes. */
const SECRET_HOLD_MS = 2_500;

type AchievementToastPresentation = {
  /** How long the toast stays open. A secret toast outlasts its whole reveal. */
  displayMs: number;
  sound: AchievementSoundKind;
};

/** Sound and duration of each variant; the toast's own look and confetti rise with the tier. */
const achievementToastPresentation = {
  bronze: { displayMs: 4_500, sound: "standard" },
  gold: { displayMs: 5_500, sound: "standard" },
  secret: {
    displayMs: Math.round(
      (secretRevealEnd + secretRevealTimeline.finalShimmerDuration) * 1_000 + SECRET_HOLD_MS,
    ),
    sound: "secret",
  },
  silver: { displayMs: 5_000, sound: "standard" },
  standard: { displayMs: 4_500, sound: "standard" },
} as const satisfies Record<AchievementToastVariant, AchievementToastPresentation>;

/** How long after one announcement appears the next one appears. */
const ANNOUNCEMENT_GAP_MS = 1_500;
const ACHIEVEMENT_TOASTER_ID = "achievement-toasts";

export { ACHIEVEMENT_TOASTER_ID, achievementToastPresentation, ANNOUNCEMENT_GAP_MS };
