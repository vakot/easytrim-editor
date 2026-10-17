import { Trophy } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  achievementToastPresentation,
  ANNOUNCEMENT_GAP_MS,
} from "../../consts/achievement-toast.consts";
import type {
  AchievementAnnouncement,
  AchievementToastVariant,
} from "../../types/achievement-toast.types";
import {
  type AchievementCelebrationSettings,
  type AchievementPresentation,
  createAchievementAnnouncementQueue,
} from "../achievement-announcement-queue";

function announcement(
  achievementId: string,
  variant: AchievementToastVariant = "standard",
): AchievementAnnouncement {
  return {
    achievementId,
    description: `${achievementId} description`,
    icon: Trophy,
    tier: variant === "bronze" || variant === "silver" || variant === "gold" ? variant : null,
    tierLabel: null,
    title: achievementId,
    unlockedLabel: "Achievement unlocked",
    variant,
  };
}

function setup(
  settings: AchievementCelebrationSettings = { reducedMotion: false, soundEnabled: true },
) {
  const events: string[] = [];
  const shown: {
    announcement: AchievementAnnouncement;
    close: ReturnType<typeof vi.fn>;
    presentation: AchievementPresentation;
  }[] = [];

  const sounds: { kind: string; stop: ReturnType<typeof vi.fn> }[] = [];
  let current = settings;

  const queue = createAchievementAnnouncementQueue({
    getSettings: () => current,
    present: (item, presentation) => {
      const close = vi.fn(() => events.push(`close:${item.achievementId}`));
      shown.push({ announcement: item, close, presentation });
      events.push(`show:${item.achievementId}`);
      return close;
    },
    sound: {
      play: (kind) => {
        const handle = { kind, stop: vi.fn(() => events.push(`silence:${kind}`)) };
        sounds.push(handle);
        events.push(`play:${kind}`);
        return handle;
      },
    },
  });

  return {
    events,
    queue,
    setSettings: (next: AchievementCelebrationSettings) => {
      current = next;
    },
    shown,
    sounds,
  };
}

const shownIds = (shown: { announcement: AchievementAnnouncement }[]) =>
  shown.map((item) => item.announcement.achievementId);

describe("createAchievementAnnouncementQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the first announcement at once with its own sound", () => {
    const { queue, shown, sounds } = setup();

    queue.enqueue([announcement("bronze-one", "bronze")]);

    expect(shownIds(shown)).toEqual(["bronze-one"]);
    expect(sounds.map((sound) => sound.kind)).toEqual(["standard"]);
    expect(shown[0]?.presentation.displayMs).toBe(achievementToastPresentation.bronze.displayMs);
  });

  it("delivers bronze, silver, and gold one by one with the gap between them", () => {
    const { events, queue, shown, sounds } = setup();
    queue.enqueue([
      announcement("bronze", "bronze"),
      announcement("silver", "silver"),
      announcement("gold", "gold"),
    ]);
    expect(shownIds(shown)).toEqual(["bronze"]);

    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS - 1);
    expect(shownIds(shown)).toEqual(["bronze"]);
    vi.advanceTimersByTime(1);
    expect(shownIds(shown)).toEqual(["bronze", "silver"]);

    shown[1]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);
    expect(shownIds(shown)).toEqual(["bronze", "silver", "gold"]);

    expect(sounds).toHaveLength(3);
    // Each cue is silenced before the next one starts, so sounds never overlap.
    expect(events).toEqual([
      "play:standard",
      "show:bronze",
      "silence:standard",
      "play:standard",
      "show:silver",
      "silence:standard",
      "play:standard",
      "show:gold",
    ]);
  });

  it("plays the secret cue only for secret announcements and keeps others on the standard cue", () => {
    const { queue, shown, sounds } = setup();
    const batch = (["standard", "bronze", "silver", "gold", "secret"] as const).map((variant) =>
      announcement(variant, variant),
    );

    queue.enqueue(batch);

    for (const item of batch) {
      expect(shownIds(shown).at(-1)).toBe(item.achievementId);
      shown.at(-1)!.presentation.onClosed();
      vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);
    }

    expect(sounds.map((sound) => sound.kind)).toEqual([
      "standard",
      "standard",
      "standard",
      "standard",
      "secret",
    ]);
    expect(shown.map((item) => item.presentation.displayMs)).toEqual(
      batch.map((item) => achievementToastPresentation[item.variant].displayMs),
    );
  });

  it("lets a secret toast stay open longer than every other variant", () => {
    const { secret, ...others } = achievementToastPresentation;

    for (const presentation of Object.values(others)) {
      expect(secret.displayMs).toBeGreaterThan(presentation.displayMs);
    }
    // The glyph reveal alone takes several seconds and the toast must outlast all of it.
    expect(secret.displayMs).toBeGreaterThanOrEqual(6_000);
  });

  it("accepts unlocks while another announcement is showing and keeps their order", () => {
    const { queue, shown } = setup();
    queue.enqueue([announcement("a"), announcement("b")]);
    queue.enqueue([announcement("c")]);
    vi.advanceTimersByTime(60_000);
    expect(shownIds(shown)).toEqual(["a"]);

    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);
    queue.enqueue([announcement("d")]);
    shown[1]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);
    shown[2]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);

    expect(shownIds(shown)).toEqual(["a", "b", "c", "d"]);
  });

  it("makes an unlock arriving during the gap wait out the rest of it", () => {
    const { queue, shown } = setup();
    queue.enqueue([announcement("a")]);
    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS - 500);

    queue.enqueue([announcement("b")]);
    expect(shownIds(shown)).toEqual(["a"]);

    vi.advanceTimersByTime(500);
    expect(shownIds(shown)).toEqual(["a", "b"]);
  });

  it("starts immediately again once the gap has passed with nothing queued", () => {
    const { queue, shown } = setup();
    queue.enqueue([announcement("a")]);
    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS * 3);

    queue.enqueue([announcement("b")]);

    expect(shownIds(shown)).toEqual(["a", "b"]);
  });

  it("never announces the same achievement twice", () => {
    const { queue, shown } = setup();

    queue.enqueue([announcement("a"), announcement("a"), announcement("b")]);
    queue.enqueue([announcement("b")]);
    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);
    queue.enqueue([announcement("a"), announcement("b")]);
    shown[1]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS * 5);
    queue.enqueue([announcement("a")]);

    expect(shownIds(shown)).toEqual(["a", "b"]);
  });

  it("advances after a manual dismissal and ignores a repeated close", () => {
    const { events, queue, shown } = setup();
    queue.enqueue([announcement("a", "secret"), announcement("b")]);

    shown[0]!.presentation.onClosed();
    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);

    expect(shownIds(shown)).toEqual(["a", "b"]);
    expect(events.filter((event) => event === "silence:secret")).toHaveLength(1);

    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS * 3);
    expect(shownIds(shown)).toEqual(["a", "b"]);
  });

  it("silences a sound as soon as its toast is dismissed early", () => {
    const { queue, shown, sounds } = setup();
    queue.enqueue([announcement("a", "secret")]);
    expect(sounds[0]?.stop).not.toHaveBeenCalled();

    shown[0]!.presentation.onClosed();

    expect(sounds[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it("skips the sound but still shows the toast when sound is off", () => {
    const { queue, shown, sounds } = setup({ reducedMotion: false, soundEnabled: false });

    queue.enqueue([announcement("a", "secret")]);

    expect(shownIds(shown)).toEqual(["a"]);
    expect(sounds).toHaveLength(0);
  });

  it("reads the settings again for each announcement", () => {
    const { queue, setSettings, shown, sounds } = setup();
    queue.enqueue([announcement("a"), announcement("b")]);
    expect(sounds).toHaveLength(1);

    setSettings({ reducedMotion: true, soundEnabled: false });
    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);

    expect(sounds).toHaveLength(1);
    expect(shown.map((item) => item.presentation.reducedMotion)).toEqual([false, true]);
  });

  it("still announces under reduced motion, with a short secret toast", () => {
    const { queue, shown } = setup({ reducedMotion: true, soundEnabled: true });

    queue.enqueue([announcement("secret", "secret"), announcement("gold", "gold")]);
    shown[0]!.presentation.onClosed();
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);

    expect(shownIds(shown)).toEqual(["secret", "gold"]);
    expect(shown[0]!.presentation.displayMs).toBe(achievementToastPresentation.standard.displayMs);
    expect(shown[1]!.presentation.displayMs).toBe(achievementToastPresentation.gold.displayMs);
  });

  it("keeps going when an announcement cannot be shown", () => {
    const presented: string[] = [];
    const stop = vi.fn();
    const queue = createAchievementAnnouncementQueue({
      getSettings: () => ({ reducedMotion: false, soundEnabled: true }),
      present: (item) => {
        presented.push(item.achievementId);
        if (item.achievementId === "a") throw new Error("toaster unavailable");
        return () => undefined;
      },
      sound: { play: () => ({ stop }) },
    });

    expect(() => queue.enqueue([announcement("a"), announcement("b")])).not.toThrow();
    expect(stop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS);

    expect(presented).toEqual(["a", "b"]);
  });

  describe("dispose", () => {
    it("closes what is showing, silences its sound, and drops everything pending", () => {
      const { events, queue, shown, sounds } = setup();
      queue.enqueue([announcement("a", "secret"), announcement("b")]);

      queue.dispose();
      vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS * 5);

      expect(shown[0]?.close).toHaveBeenCalledTimes(1);
      expect(sounds[0]?.stop).toHaveBeenCalledTimes(1);
      expect(shownIds(shown)).toEqual(["a"]);
      expect(events).toContain("close:a");
    });

    it("cancels the scheduled next announcement", () => {
      const { queue, shown } = setup();
      queue.enqueue([announcement("a"), announcement("b")]);
      shown[0]!.presentation.onClosed();

      queue.dispose();
      vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS * 5);

      expect(shownIds(shown)).toEqual(["a"]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("ignores later unlocks and late close notifications", () => {
      const { queue, shown } = setup();
      queue.enqueue([announcement("a")]);
      queue.dispose();

      queue.enqueue([announcement("b")]);
      shown[0]!.presentation.onClosed();
      queue.dispose();

      expect(shownIds(shown)).toEqual(["a"]);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
