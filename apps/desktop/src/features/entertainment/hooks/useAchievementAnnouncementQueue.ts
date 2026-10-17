import { useCallback, useEffect, useRef } from "react";

import {
  type AchievementCelebrationSettings,
  createAchievementAnnouncementQueue,
} from "../lib/achievement-announcement-queue";
import { createAchievementSoundPlayer } from "../lib/achievement-sound";
import { presentAchievementToast } from "../lib/achievement-toast.utils";
import type { AchievementAnnouncement } from "../types/achievement-toast.types";

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Delivers achievement announcements one after another as toasts with confetti and sound. Settings
 * default to the system's reduced-motion preference with sound on; pass overrides to change them,
 * and the latest values apply to each announcement as it starts. Everything pending, playing, or
 * scheduled is released when the component unmounts.
 */
function useAchievementAnnouncementQueue(overrides?: Partial<AchievementCelebrationSettings>) {
  const overridesRef = useRef(overrides);
  const runtime = useRef<{
    queue: ReturnType<typeof createAchievementAnnouncementQueue>;
    sound: ReturnType<typeof createAchievementSoundPlayer>;
  } | null>(null);

  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);

  // The queue and audio context are created on the first announcement, so an app that never
  // announces anything never opens an audio context.
  const enqueue = useCallback((announcements: readonly AchievementAnnouncement[]) => {
    if (announcements.length === 0) return;
    if (!runtime.current) {
      const sound = createAchievementSoundPlayer();
      runtime.current = {
        queue: createAchievementAnnouncementQueue({
          getSettings: () => ({
            reducedMotion: overridesRef.current?.reducedMotion ?? prefersReducedMotion(),
            soundEnabled: overridesRef.current?.soundEnabled ?? true,
          }),
          present: presentAchievementToast,
          sound,
        }),
        sound,
      };
    }
    runtime.current.queue.enqueue(announcements);
  }, []);

  useEffect(
    () => () => {
      runtime.current?.queue.dispose();
      runtime.current?.sound.dispose();
      runtime.current = null;
    },
    [],
  );

  return enqueue;
}

export { useAchievementAnnouncementQueue };
