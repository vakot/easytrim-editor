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
 * Delivers achievement announcements one at a time, in order, each with its own toast, confetti,
 * and sound. The next announcement opens a fixed gap after the previous one closed, however it
 * closed, and a sound never outlives its toast, so celebrations never overlap. Presentation owns
 * how long a toast stays open; this only owns what comes next.
 */
function createAchievementAnnouncementQueue({
  gapMs = ANNOUNCEMENT_GAP_MS,
  getSettings,
  present,
  sound,
}: AchievementAnnouncementQueueOptions): AchievementAnnouncementQueue {
  const pending: AchievementAnnouncement[] = [];
  const known = new Set<string>();
  let active: { close: () => void; sound: AchievementSoundHandle } | null = null;
  let gapTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function advance() {
    if (disposed || active || gapTimer !== null) return;
    const announcement = pending.shift();
    if (!announcement) return;

    const { reducedMotion, soundEnabled } = getSettings();
    const presentation = achievementToastPresentation[announcement.variant];
    const current = {
      close: () => undefined as void,
      sound: soundEnabled ? sound.play(presentation.sound) : silentSound,
    };

    active = current;

    let closed = false;
    const onClosed = () => {
      if (closed || disposed) return;
      closed = true;
      current.sound.stop();
      if (active === current) active = null;
      gapTimer = setTimeout(() => {
        gapTimer = null;
        advance();
      }, gapMs);
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
  }

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      pending.length = 0;
      if (gapTimer !== null) clearTimeout(gapTimer);
      gapTimer = null;
      active?.sound.stop();
      active?.close();
      active = null;
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
