import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  records: {
    discoveredSplashMessageIds: [] as string[],
    unlockedAchievements: {} as Record<string, number>,
    viewedAtMillis: null as number | null,
  },
  unlockAchievements: vi.fn(),
}));

vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: vi.fn(),
  markAchievementsViewed: vi.fn(),
  recordSplashMessageDiscovery: vi.fn(),
  unlockAchievements: native.unlockAchievements,
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { timelineShortcutExecuted } from "@/app/store/actions/timeline-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { audioTrackFiltersApplied } from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import {
  editingInstanceExportAttemptQueued,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import type { ExportAttempt } from "@/domain/editing-instance";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { firstSource, media, mediaWithAudio, secondSource } from "@/test/source.fixtures";

function createStore() {
  return createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
}

function queueAttempt(id: string): ExportAttempt {
  const snapshot = createDefaultEditorSnapshot(firstSource);
  return {
    capturedAt: 10,
    id,
    metrics: { durationMs: null, progressPercent: 0 },
    output: {
      displayName: "output.mp4",
      displayPath: "C:/Media/output.mp4",
      outputId: "output-1",
    },
    request: {} as ExportAttempt["request"],
    route: "fast",
    snapshot,
    state: { queuedAt: 10, status: "queued" },
  } as unknown as ExportAttempt;
}

describe("onboarding achievement triggers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    native.records = { ...emptyAchievementRecords, unlockedAchievements: {} };
    native.unlockAchievements.mockImplementation(async (ids: string[]) => {
      const unlockedAchievementIds: string[] = [];
      for (const id of ids) {
        if (native.records.unlockedAchievements[id] !== undefined) continue;
        native.records.unlockedAchievements[id] =
          100 + Object.keys(native.records.unlockedAchievements).length;
        unlockedAchievementIds.push(id);
      }
      return { records: structuredClone(native.records), unlockedAchievementIds };
    });
  });

  it("unlocks on successful import, meaningful trim, crop, filter change, queue, and timeline shortcut", async () => {
    const store = createStore();
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
    store.dispatch(
      trimChanged({
        trim: { endMicros: 4_000_000, sourceDurationMicros: 5_000_000, startMicros: 1_000_000 },
      }),
    );
    store.dispatch(
      cropChanged({
        crop: { height: 1, width: 0.8, x: 0.1, y: 0 },
        resolution: { height: 1080, width: 1536 },
      }),
    );
    store.dispatch(
      audioTrackFiltersApplied({
        filters: [{ enabled: true, gainDb: 3, id: "gain", type: "gain" }],
        streamIndex: 2,
      }),
    );

    const snapshot = createDefaultEditorSnapshot(firstSource);
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "instance-1",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
        },
      ]),
    );
    store.dispatch(
      editingInstanceExportAttemptQueued({ id: "instance-1", attempt: queueAttempt("attempt-1") }),
    );
    store.dispatch(timelineShortcutExecuted());

    await vi.waitFor(() => {
      expect(Object.keys(native.records.unlockedAchievements).sort()).toEqual(
        [
          "first-contact",
          "cut-to-the-chase",
          "frame-by-frame",
          "fine-tuning",
          "queued-up",
          "shortcut-taken",
        ].sort(),
      );
    });
  });

  it("does not unlock for no-op trim, default crop, empty filters, or failed queue insertion", async () => {
    const store = createStore();
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(
      trimChanged({
        trim: { endMicros: 5_000_000, sourceDurationMicros: 5_000_000, startMicros: 0 },
      }),
    );
    store.dispatch(
      cropChanged({
        crop: { height: 1, width: 1, x: 0, y: 0 },
        resolution: { height: 1080, width: 1920 },
      }),
    );
    store.dispatch(audioTrackFiltersApplied({ filters: [], streamIndex: 2 }));
    store.dispatch(
      editingInstanceExportAttemptQueued({ id: "missing", attempt: queueAttempt("attempt-1") }),
    );
    // The ready action above is the only successful import event in this scenario.
    store.dispatch(timelineShortcutExecuted());

    await vi.waitFor(() => expect(native.unlockAchievements).toHaveBeenCalled());
    expect(Object.keys(native.records.unlockedAchievements).sort()).toEqual([
      "first-contact",
      "shortcut-taken",
    ]);
  });

  it("keeps First Contact locked when a stale sourceReady arrives after selecting another source", () => {
    const store = createStore();
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceSelected({ loadToken: 2, source: secondSource }));

    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));

    expect(store.getState().source).toMatchObject({
      loadToken: 2,
      media: null,
      status: "loading-source",
    });
    expect(native.unlockAchievements).not.toHaveBeenCalled();
    expect(native.records.unlockedAchievements["first-contact"]).toBeUndefined();
  });

  it("skips repeated unlock requests and retains the original timestamp", async () => {
    const store = createStore();
    store.dispatch(timelineShortcutExecuted());
    await vi.waitFor(() =>
      expect(
        store.getState().achievements.records?.unlockedAchievements["shortcut-taken"],
      ).toBeDefined(),
    );
    const unlockedAt = native.records.unlockedAchievements["shortcut-taken"];

    store.dispatch(timelineShortcutExecuted());
    expect(native.unlockAchievements).toHaveBeenCalledTimes(1);

    expect(native.records.unlockedAchievements["shortcut-taken"]).toBe(unlockedAt);
  });
});
