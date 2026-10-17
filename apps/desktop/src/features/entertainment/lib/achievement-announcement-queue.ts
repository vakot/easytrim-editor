import {
  achievementToastPresentation,
  ANNOUNCEMENT_GAP_MS,
} from "../consts/achievement-toast.consts";
import type { AchievementAnnouncement } from "../types/achievement-toast.types";

import type { AchievementSoundHandle, AchievementSoundPlayer } from "./achievement-sound";

/** The conditions of one announcement, read when it starts so changes apply to the next one. */
type AchievementCelebrationSettings = {
  reducedMotion: boolean;
  soundEnabled: boolean;
};

type AchievementPresentation = {
  /** How long the announcement should stay open. */
  displayMs: number;
  /** Call exactly once when the announcement closes, whether on its own or dismissed by the user. */
  onClosed: () => void;
  reducedMotion: boolean;
};

type AchievementAnnouncementQueueOptions = {
  gapMs?: number;
  getSettings: () => AchievementCelebrationSettings;
  /** Shows an announcement and returns a function that closes it again. */
  present: (
    announcement: AchievementAnnouncement,
    presentation: AchievementPresentation,
  ) => () => void;
  sound: Pick<AchievementSoundPlayer, "play">;
};

type AchievementAnnouncementQueue = {
  /** Frees every timer and closes whatever is showing; later calls do nothing. */
  dispose: () => void;
  /** Adds announcements in order; ones already queued, showing, or shown are ignored. */
  enqueue: (announcements: readonly AchievementAnnouncement[]) => void;
};

const silentSound: AchievementSoundHandle = { stop: () => undefined };

/**
 * Delivers achievement announcements in order, each with its own toast, confetti, and sound. They
 * appear in sequence, each after a fixed gap from the previous one's appearance, so earlier toasts
 * may stay open and stack under later ones. Only the newest announcement's sound plays: starting
 * the next one cuts off the previous, so sounds never overlap. Presentation owns how long a toast
 * stays open; this only owns when the next one appears.
 */
function createAchievementAnnouncementQueue({
  gapMs = ANNOUNCEMENT_GAP_MS,
  getSettings,
  present,
  sound,
}: AchievementAnnouncementQueueOptions): AchievementAnnouncementQueue {
  const pending: AchievementAnnouncement[] = [];
  const known = new Set<string>();
  const open = new Set<{ close: () => void; sound: AchievementSoundHandle }>();
  let latestSound: AchievementSoundHandle | null = null;
  let gapTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function advance() {
    if (disposed || gapTimer !== null) return;
    const announcement = pending.shift();
    if (!announcement) return;

    const { reducedMotion, soundEnabled } = getSettings();
    const presentation = achievementToastPresentation[announcement.variant];
    latestSound?.stop();
    const current = {
      close: () => undefined as void,
      sound: soundEnabled ? sound.play(presentation.sound) : silentSound,
    };

    latestSound = current.sound;
    open.add(current);

    let closed = false;
    const onClosed = () => {
      if (closed || disposed) return;
      closed = true;
      current.sound.stop();
      if (latestSound === current.sound) latestSound = null;
      open.delete(current);
    };

    try {
      current.close = present(announcement, {
        // Without the animated reveal a secret toast needs no longer than a standard one.
        displayMs:
          reducedMotion && announcement.variant === "secret"
            ? achievementToastPresentation.standard.displayMs
            : presentation.displayMs,
        onClosed,
        reducedMotion,
      });
    } catch {
      // A toast that cannot be shown must not stall the announcements behind it.
      onClosed();
    }

    // The next announcement is measured from this one's appearance, whether or not it is still open.
    gapTimer = setTimeout(() => {
      gapTimer = null;
      advance();
    }, gapMs);
  }

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      pending.length = 0;
      if (gapTimer !== null) clearTimeout(gapTimer);
      gapTimer = null;
      for (const current of [...open]) {
        current.sound.stop();
        current.close();
      }
      open.clear();
    },
    enqueue: (announcements) => {
      if (disposed) return;
      for (const announcement of announcements) {
        if (known.has(announcement.achievementId)) continue;
        known.add(announcement.achievementId);
        pending.push(announcement);
      }
      advance();
    },
  };
}

export { createAchievementAnnouncementQueue };
export type { AchievementCelebrationSettings, AchievementPresentation };
