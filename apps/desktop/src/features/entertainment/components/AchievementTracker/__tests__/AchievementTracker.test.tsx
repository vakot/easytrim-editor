import { act, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AchievementRecords } from "@/domain/achievement-records";
import type { UsageStatistics } from "@/domain/usage-statistics";

const mocks = vi.hoisted(() => ({
  getAchievementRecords: vi.fn(),
  getUsageStatistics: vi.fn(),
  recordSplashMessageDiscovery: vi.fn(),
  toast: vi.fn(),
  toastDismiss: vi.fn(),
  unlockAchievements: vi.fn(),
}));

vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: mocks.getAchievementRecords,
  recordSplashMessageDiscovery: mocks.recordSplashMessageDiscovery,
  unlockAchievements: mocks.unlockAchievements,
}));
vi.mock("@/lib/tauri/statistics", () => ({ getUsageStatistics: mocks.getUsageStatistics }));
vi.mock("sonner", () => ({ toast: { custom: mocks.toast, dismiss: mocks.toastDismiss } }));
vi.mock("@easytrim-editor/ui/achievement-unlock-toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@easytrim-editor/ui/achievement-unlock-toast")>()),
  AchievementUnlockToast: () => null,
}));

import { achievementAnnouncementQueued } from "@/app/store/slices/achievements-slice";
import { editingInstanceExportCompleted } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { ANNOUNCEMENT_GAP_MS } from "../../../consts/achievement-toast.consts";
import type { AchievementAnnouncement } from "../../../types/achievement-toast.types";
import { AchievementTracker } from "../AchievementTracker";

type ToastOptions = {
  duration: number;
  id: string;
  onAutoClose: () => void;
  onDismiss: () => void;
};

/** The announcement each shown toast was given, in the order the toasts were shown. */
function announced() {
  return mocks.toast.mock.calls.map(([renderToast]) => {
    const { announcement } = (renderToast() as { props: { announcement: AchievementAnnouncement } })
      .props;

    return `${announcement.variant}:${announcement.title}`;
  });
}

function toastOptions(index: number): ToastOptions {
  return mocks.toast.mock.calls[index]![1] as ToastOptions;
}

/** Dismisses one toast, then advances the queue by one appearance interval. */
async function closeToast(index: number) {
  act(() => toastOptions(index).onAutoClose());
  await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS));
}

/** An in-memory stand-in for the native store: it unlocks each achievement only once. */
function fakeNativeAchievements(initial: AchievementRecords = emptyAchievementRecords) {
  let records = structuredClone(initial);
  let now = 10_000;
  mocks.getAchievementRecords.mockImplementation(async () => structuredClone(records));
  mocks.unlockAchievements.mockImplementation(async (ids: string[]) => {
    const unlockedAchievementIds = ids.filter((id) => !(id in records.unlockedAchievements));
    now += 1;
    for (const id of unlockedAchievementIds) records.unlockedAchievements[id] = now;
    records = structuredClone(records);
    return { records: structuredClone(records), unlockedAchievementIds };
  });
  return () => records;
}

function createStore() {
  return createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
}

function renderTracker() {
  const store = createStore();
  const view = render(
    <Provider store={store}>
      <AchievementTracker />
    </Provider>,
  );

  return Object.assign(store, { unmount: view.unmount });
}

function completeExport(store: ReturnType<typeof renderTracker>, statistics: UsageStatistics) {
  mocks.getUsageStatistics.mockResolvedValue(statistics);
  act(() => {
    store.dispatch(
      editingInstanceExportCompleted({
        attemptId: crypto.randomUUID(),
        durationMs: 1_000,
        id: "instance-1",
        result: { displayName: "out.mp4", displayPath: "out.mp4", operationId: "operation" },
      }),
    );
  });
}

describe("AchievementTracker", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("unlocks tiers earned before this session without announcing them", async () => {
    const nativeRecords = fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 150 });
    const store = renderTracker();

    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS * 3));

    expect(Object.keys(nativeRecords().unlockedAchievements).sort()).toEqual([
      "export-mastery-bronze",
      "export-mastery-gold",
      "export-mastery-silver",
    ]);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces a newly unlocked onboarding achievement through the shared tracker", async () => {
    fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    act(() => store.dispatch(achievementAnnouncementQueued({ ids: ["fine-tuning"] })));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(announced()).toEqual(["standard:Fine Tuning"]);
    expect(toastOptions(0)).toMatchObject({ id: "achievement-unlocked:fine-tuning" });
    expect(store.getState().achievements.announcementQueue).toEqual([]);
  });

  it("gives every tier its own unlock time and keeps earlier unlock times", async () => {
    const nativeRecords = fakeNativeAchievements({
      ...emptyAchievementRecords,
      unlockedAchievements: { "export-mastery-bronze": 42 },
    });

    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, gifExports: 1 });
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...emptyUsageStatistics, gifExports: 10 });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));

    const unlocked = nativeRecords().unlockedAchievements;
    expect(unlocked["export-mastery-bronze"]).toBe(42);
    expect(unlocked["gif-creator-bronze"]).toBeGreaterThan(42);
    expect(unlocked["gif-creator-silver"]).toBeGreaterThan(unlocked["gif-creator-bronze"]!);
  });

  it("announces a newly unlocked tier with its series and tier", async () => {
    fakeNativeAchievements();
    const previous = { ...emptyUsageStatistics, gifExports: 4 };
    mocks.getUsageStatistics.mockResolvedValue(previous);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...previous, gifExports: 5 });

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(announced()).toEqual(["silver:GIF Creator"]);
    expect(toastOptions(0)).toMatchObject({ id: "achievement-unlocked:gif-creator-silver" });
  });

  it("announces every tier one export unlocks on its own, one after another", async () => {
    fakeNativeAchievements();
    const previous = {
      ...emptyUsageStatistics,
      optimizedExports: 1,
      outputBytes: 1_024,
      sourceBytes: 1_024,
    };

    mocks.getUsageStatistics.mockResolvedValue(previous);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    // One large export can pass more than one threshold at once.
    completeExport(store, {
      ...previous,
      outputBytes: 12 * 1_024 ** 3,
      sourceBytes: 12 * 1_024 ** 3,
    });

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(announced()).toEqual(["bronze:Data Cruncher"]);

    await closeToast(0);
    expect(announced()).toEqual(["bronze:Data Cruncher", "silver:Data Cruncher"]);
    expect(toastOptions(1).id).toBe("achievement-unlocked:data-cruncher-silver");
  });

  it("keeps unlocks across series separate and never repeats them", async () => {
    fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...emptyUsageStatistics, gifExports: 1 });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    completeExport(store, { ...emptyUsageStatistics, gifExports: 1 });
    await waitFor(() => expect(mocks.getUsageStatistics).toHaveBeenCalledTimes(3));

    await closeToast(0);
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS * 5));

    expect(announced()).toEqual(["bronze:Export Mastery", "bronze:GIF Creator"]);
  });

  it("queues unlocks that arrive while an announcement is showing", async () => {
    fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    act(() => store.dispatch(achievementAnnouncementQueued({ ids: ["fine-tuning"] })));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    act(() =>
      store.dispatch(achievementAnnouncementQueued({ ids: ["queued-up", "shortcut-taken"] })),
    );
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS));
    expect(announced()).toEqual(["standard:Fine Tuning", "standard:Queued Up"]);
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS));

    expect(announced()).toEqual([
      "standard:Fine Tuning",
      "standard:Queued Up",
      "standard:Shortcut Taken",
    ]);
  });

  it("dismisses the showing toast and stops announcing when it unmounts", async () => {
    fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
    act(() => store.dispatch(achievementAnnouncementQueued({ ids: ["fine-tuning", "queued-up"] })));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));

    store.unmount();
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS * 5));

    expect(mocks.toastDismiss).toHaveBeenCalledWith("achievement-unlocked:fine-tuning");
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("does not announce retroactive unlocks after a failed first attempt", async () => {
    fakeNativeAchievements();
    mocks.unlockAchievements.mockRejectedValueOnce({ code: "internal" });
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 3 });
    const store = renderTracker();
    await waitFor(() => expect(mocks.unlockAchievements).toHaveBeenCalledTimes(1));
    expect(store.getState().achievements.initialized).toBe(false);

    completeExport(store, { ...emptyUsageStatistics, optimizedExports: 3 });

    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  describe("collectors", () => {
    const seriesIds = [
      "export-mastery",
      "lossless-precision",
      "gif-creator",
      "audio-specialist",
      "time-well-spent",
      "data-cruncher",
      "storage-saver",
    ];

    const tierIds = (tier: string) => seriesIds.map((id) => `${id}-${tier}`);
    const unlockedAt = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 500]));

    it("unlocks a collector in the same evaluation as its final tier and announces each once", async () => {
      const nativeRecords = fakeNativeAchievements({
        ...emptyAchievementRecords,
        unlockedAchievements: unlockedAt(tierIds("bronze").slice(0, -1)),
      });

      mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
      const store = renderTracker();
      await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
      expect(mocks.unlockAchievements).not.toHaveBeenCalled();

      // Storage Saver Bronze is the last original Bronze tier, and unlocking it completes the set.
      completeExport(store, { ...emptyUsageStatistics, sourceBytes: 300 * 1_024 ** 2 });

      await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
      expect(mocks.unlockAchievements).toHaveBeenCalledTimes(1);
      expect(mocks.unlockAchievements).toHaveBeenCalledWith([
        "storage-saver-bronze",
        "first-contact",
        "bronze-collector",
      ]);

      await closeToast(0);
      await closeToast(1);
      await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS * 5));

      expect(announced()).toEqual([
        "bronze:Storage Saver",
        "standard:First Contact",
        "secret:Bronze Collector",
      ]);
      expect(nativeRecords().unlockedAchievements["bronze-collector"]).toBeGreaterThan(500);
      expect(nativeRecords().unlockedAchievements["silver-collector"]).toBeUndefined();
    });

    it("unlocks collectors from previously unlocked tiers silently at startup", async () => {
      const nativeRecords = fakeNativeAchievements({
        ...emptyAchievementRecords,
        unlockedAchievements: unlockedAt([
          ...tierIds("bronze"),
          ...tierIds("silver"),
          ...tierIds("gold"),
        ]),
      });

      mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
      const store = renderTracker();

      await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
      await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS * 3));

      expect(mocks.unlockAchievements).toHaveBeenCalledTimes(1);
      expect(mocks.unlockAchievements).toHaveBeenCalledWith([
        "bronze-collector",
        "silver-collector",
        "gold-collector",
      ]);
      expect(Object.keys(nativeRecords().unlockedAchievements)).toHaveLength(24);
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("neither writes nor announces again when nothing new is earned", async () => {
      fakeNativeAchievements({
        ...emptyAchievementRecords,
        unlockedAchievements: unlockedAt(tierIds("bronze").slice(0, -1)),
      });
      const unlockingStatistics = { ...emptyUsageStatistics, sourceBytes: 300 * 1_024 ** 2 };
      mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
      const store = renderTracker();
      await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
      completeExport(store, unlockingStatistics);
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));

      completeExport(store, { ...unlockingStatistics });
      await waitFor(() => expect(mocks.getUsageStatistics).toHaveBeenCalledTimes(3));
      completeExport(store, { ...unlockingStatistics, sourceBytes: 400 * 1_024 ** 2 });
      await waitFor(() => expect(mocks.getUsageStatistics).toHaveBeenCalledTimes(4));
      await closeToast(0);
      await closeToast(1);
      await act(() => vi.advanceTimersByTimeAsync(ANNOUNCEMENT_GAP_MS * 5));

      expect(mocks.unlockAchievements).toHaveBeenCalledTimes(1);
      expect(mocks.toast).toHaveBeenCalledTimes(3);
    });
  });
});
