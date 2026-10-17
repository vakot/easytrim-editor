import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n/config";

import { ANNOUNCEMENT_GAP_MS } from "../../consts/achievement-toast.consts";
import { createAchievementAnnouncements } from "../../lib/achievement-announcements.utils";
import { useAchievementAnnouncementQueue } from "../useAchievementAnnouncementQueue";

const sonner = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn() }));

vi.mock("sonner", () => ({ toast: sonner }));

type ToastOptions = {
  duration: number;
  id: string;
  onAutoClose: () => void;
  onDismiss: () => void;
};

const t = i18n.t.bind(i18n);
const announce = (...ids: string[]) => createAchievementAnnouncements(ids, t);
const options = (index: number) => sonner.custom.mock.calls[index]![1] as ToastOptions;
const element = (index: number) =>
  (sonner.custom.mock.calls[index]![0] as () => { props: { reducedMotion: boolean } })();

function audioContext(overrides: Partial<Record<string, unknown>> = {}) {
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    close: vi.fn(async () => undefined),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        value: 0,
      },
    })),
    createOscillator: vi.fn(() => {
      const oscillator = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: { value: 0 },
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
        type: "sine",
      };

      oscillators.push(oscillator);
      return oscillator;
    }),
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => undefined),
    state: "running",
    ...overrides,
  };

  return { context, oscillators };
}

function installAudioContext(factory: () => unknown) {
  const constructor = vi.fn(function AudioContextStub() {
    return factory();
  });

  vi.stubGlobal("AudioContext", constructor);
  return constructor;
}

describe("useAchievementAnnouncementQueue", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.useFakeTimers();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows nothing and opens no audio context until something is announced", () => {
    const constructor = installAudioContext(() => audioContext().context);
    const { result, unmount } = renderHook(() => useAchievementAnnouncementQueue());

    act(() => result.current([]));
    unmount();

    expect(sonner.custom).not.toHaveBeenCalled();
    expect(constructor).not.toHaveBeenCalled();
  });

  it("shows each announcement as its own sonner toast with its own sound", () => {
    const first = audioContext();
    installAudioContext(() => first.context);
    const { result } = renderHook(() => useAchievementAnnouncementQueue());

    act(() => result.current(announce("gif-creator-bronze", "gif-creator-silver")));

    expect(sonner.custom).toHaveBeenCalledTimes(1);
    expect(options(0)).toMatchObject({ id: "achievement-unlocked:gif-creator-bronze" });
    expect(first.oscillators.length).toBeGreaterThan(0);
    const voicesForFirst = first.oscillators.length;

    act(() => options(0).onAutoClose());
    act(() => vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS));

    expect(sonner.custom).toHaveBeenCalledTimes(2);
    expect(options(1)).toMatchObject({ id: "achievement-unlocked:gif-creator-silver" });
    expect(first.oscillators.length).toBe(voicesForFirst * 2);
  });

  it("still shows the toast when audio is unavailable or blocked", () => {
    installAudioContext(() => {
      throw new DOMException("not allowed", "NotAllowedError");
    });
    const { result } = renderHook(() => useAchievementAnnouncementQueue());

    expect(() => act(() => result.current(announce("fine-tuning")))).not.toThrow();

    expect(sonner.custom).toHaveBeenCalledTimes(1);
  });

  it("survives a suspended context whose resume is refused", async () => {
    const blocked = audioContext({
      resume: vi.fn(async () => {
        throw new DOMException("blocked", "NotAllowedError");
      }),
      state: "suspended",
    });

    installAudioContext(() => blocked.context);
    const { result } = renderHook(() => useAchievementAnnouncementQueue());

    act(() => result.current(announce("fine-tuning")));
    await act(() => Promise.resolve());

    expect(sonner.custom).toHaveBeenCalledTimes(1);
    expect(blocked.context.resume).toHaveBeenCalledTimes(1);
  });

  it("applies the latest sound and motion settings to each announcement", () => {
    const sound = audioContext();
    installAudioContext(() => sound.context);
    const { rerender, result } = renderHook(
      (props: { reducedMotion: boolean; soundEnabled: boolean }) =>
        useAchievementAnnouncementQueue(props),
      { initialProps: { reducedMotion: false, soundEnabled: false } },
    );

    act(() => result.current(announce("fine-tuning", "queued-up")));
    expect(sound.oscillators).toHaveLength(0);
    expect(element(0).props.reducedMotion).toBe(false);

    rerender({ reducedMotion: true, soundEnabled: true });
    act(() => options(0).onAutoClose());
    act(() => vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS));

    expect(sound.oscillators.length).toBeGreaterThan(0);
    expect(element(1).props.reducedMotion).toBe(true);
  });

  it("follows the system reduced-motion preference by default", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    installAudioContext(() => audioContext().context);
    const { result } = renderHook(() => useAchievementAnnouncementQueue());

    act(() => result.current(announce("fine-tuning")));

    expect(element(0).props.reducedMotion).toBe(true);
  });

  it("dismisses the toast, silences the sound, and closes audio when unmounted", () => {
    const sound = audioContext();
    installAudioContext(() => sound.context);
    const { result, unmount } = renderHook(() => useAchievementAnnouncementQueue());
    act(() => result.current(announce("fine-tuning", "queued-up")));

    unmount();
    act(() => vi.advanceTimersByTime(ANNOUNCEMENT_GAP_MS * 5));

    expect(sonner.dismiss).toHaveBeenCalledWith("achievement-unlocked:fine-tuning");
    expect(sound.context.close).toHaveBeenCalledTimes(1);
    expect(sonner.custom).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("works again after the effects are replayed, as under strict mode", () => {
    installAudioContext(() => audioContext().context);
    const { rerender, result, unmount } = renderHook(() => useAchievementAnnouncementQueue());

    rerender();
    act(() => result.current(announce("fine-tuning")));

    expect(sonner.custom).toHaveBeenCalledTimes(1);
    unmount();
  });
});
