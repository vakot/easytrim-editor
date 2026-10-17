import { toast } from "sonner";

import { AchievementUnlockToast } from "../components/AchievementUnlockToast";
import type { AchievementAnnouncement } from "../types/achievement-toast.types";

import type { AchievementPresentation } from "./achievement-announcement-queue";

/**
 * Shows an announcement as its own Sonner toast and returns the function that dismisses it. Sonner
 * keeps its usual behavior: the toast pauses while hovered, the user can swipe it away, and the
 * presentation reports every way it closes so the queue advances after each.
 */
function presentAchievementToast(
  announcement: AchievementAnnouncement,
  { displayMs, onClosed, reducedMotion }: AchievementPresentation,
): () => void {
  const id = `achievement-unlocked:${announcement.achievementId}`;
  toast.custom(
    () => <AchievementUnlockToast announcement={announcement} reducedMotion={reducedMotion} />,
    {
      // Sonner sizes only its own styled toasts, so the toaster width is applied here; its mobile
      // layout rule is more specific and still makes the toast full width on small screens.
      className: "w-(--width)",
      duration: displayMs,
      id,
      onAutoClose: onClosed,
      onDismiss: onClosed,
    },
  );
  return () => {
    toast.dismiss(id);
  };
}

export { presentAchievementToast };
