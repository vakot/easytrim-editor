import { beforeEach, describe, expect, it } from "vitest";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  audioTrackFiltersApplied,
  audioTrackSyncOffsetChanged,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { cropChanged, flipToggled, rotationChanged } from "@/app/store/slices/crop-slice";
import {
  activeEditingInstanceChanged,
  editingInstanceExportAttemptQueued,
  editingInstanceGifSettingsChanged,
  editingInstancesAdded,
  editingInstancesClosed,
} from "@/app/store/slices/editing-instances-slice";
import { exportArgumentsChanged } from "@/app/store/slices/export-presets-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import {
  historyOperationRecorded,
  historyReplayFinished,
  historyReplayStarted,
  selectWorkspaceHistory,
  workspaceHistoryRestored,
} from "@/app/store/slices/workspace-history-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { type HistoryData, WorkspaceHistory } from "@/domain/workspace-history";
import { firstSource, mediaWithAudio, secondSource } from "@/test/source.fixtures";

import {
  createWorkspaceRecoveryBackup,
  dismissWorkspaceRecoveryNotice,
  getWorkspaceRecoveryCandidate,
  initializeWorkspaceRecovery,
  RECOVERY_MAX_SERIALIZED_LENGTH,
  retainWorkspaceRecoveryOnAcceptedShutdown,
} from "../workspace-recovery";

const CURRENT_KEY = "easytrim:workspace-recovery:current";
const broadcastNormalization = {
  enabled: true,
  id: "norm",
  loudnessRangeLu: 11,
  maxTruePeakDb: -2,
  targetLufs: -23,
  type: "loudnessNormalization" as const,
};

const CANDIDATE_KEY = "easytrim:workspace-recovery:candidate";

function instance(id: string, source = firstSource) {
  return {
    exportAttempts: [],
    id,
    importedAtMicros: 1234,
    optimizedArguments: "-crf 22",
    optimizedSettings: {
      frameRate: undefined,
      resolution: { height: 720, width: 1280 },
    },
    gifSettings: {
      frameRate: { denominator: 1, numerator: 15 },
      gifPreset: "custom" as const,
      paletteColors: 32 as const,
      paletteStatsMode: "full" as const,
      dithering: "bayer" as const,
      resolution: { height: 360, width: 640 },
    },
    origin: "source-import" as const,
    snapshot: createDefaultEditorSnapshot(source),
    sourceAvailability: "available" as const,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("workspace recovery contract", () => {
  it.each([3, 1])("budgets lifecycle history against the workspace at cursor %i", (position) => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([{ ...instance("large"), optimizedArguments: "界".repeat(900_000) }]),
    );
    const history: HistoryData = {
      version: 1,
      position,
      operations: Array.from({ length: 3 }, (_, index) => ({
        id: `close-${index}`,
        label: "Close instance",
        timestamp: index,
        kind: "external",
        type: "instances.lifecycle",
        affected: [],
        payload: JSON.parse(
          JSON.stringify({
            before: [
              {
                index: 0,
                instance: {
                  ...instance(`closed-${index}`),
                  optimizedArguments: "x".repeat(60_000),
                },
              },
            ],
            after: [],
          }),
        ),
      })),
    };

    store.dispatch(workspaceHistoryRestored(history));
    const originalHistory = selectWorkspaceHistory(store.getState());
    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "session" });
    expect(JSON.stringify(backup).length).toBeLessThanOrEqual(RECOVERY_MAX_SERIALIZED_LENGTH);
    expect(backup.instances[0]?.optimizedArguments).toHaveLength(900_000);
    expect(backup.history?.operations.map(({ id }) => id)).toEqual(["close-1", "close-2"]);
    expect(backup.history?.position).toBe(position - 1);
    expect(selectWorkspaceHistory(store.getState())).toEqual(originalHistory);
    localStorage.setItem(CURRENT_KEY, JSON.stringify(backup));
    initializeWorkspaceRecovery(createAppStore(), "next", true);
    expect(getWorkspaceRecoveryCandidate()?.history).toEqual(backup.history);
    expect(new WorkspaceHistory(backup.history).snapshot()).toEqual(backup.history);
  });

  it("serializes history including its selected position and redo branch", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("history", firstSource)]));
    store.dispatch(
      historyOperationRecorded({
        changes: [
          {
            after: { present: true, value: { endMicros: 4_000_000, startMicros: 500_000 } },
            before: { present: true, value: { kind: "full-source" } },
            field: "trim",
            target: { instanceId: "history", kind: "instance", sourceId: firstSource.sourcePath },
          },
        ],
        id: "persisted-trim",
        kind: "state",
        label: "Adjust trim",
        role: "edit",
        timestamp: 100,
      }),
    );
    store.dispatch(historyReplayStarted());
    store.dispatch(historyReplayFinished({ position: 0 }));
    const history = selectWorkspaceHistory(store.getState());
    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "session" });
    localStorage.setItem(CURRENT_KEY, JSON.stringify(JSON.parse(JSON.stringify(backup))));
    initializeWorkspaceRecovery(createAppStore(), "next", true);

    expect(getWorkspaceRecoveryCandidate()?.history).toEqual(history);
  });

  it("accepts existing recovery documents without a history field", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("legacy", firstSource)]));
    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "legacy" });
    delete (backup as { history?: unknown }).history;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(backup));
    initializeWorkspaceRecovery(createAppStore(), "next", true);

    expect(getWorkspaceRecoveryCandidate()?.instances[0]?.id).toBe("legacy");
    expect(getWorkspaceRecoveryCandidate()).not.toHaveProperty("history");
  });

  it.each([
    { operations: [], position: 0, version: 99 },
    { operations: [{ id: "broken" }], position: 1, version: 1 },
  ])("ignores invalid history without discarding valid workspace data", (history) => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("valid", firstSource)]));
    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "session" });
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ ...backup, history }));
    initializeWorkspaceRecovery(createAppStore(), "next", true);

    expect(getWorkspaceRecoveryCandidate()?.instances.map(({ id }) => id)).toEqual(["valid"]);
    expect(getWorkspaceRecoveryCandidate()).not.toHaveProperty("history");
  });

  it("retains the workspace and history across a normal restart", async () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("restart", firstSource)]));
    store.dispatch(
      historyOperationRecorded({
        affected: [{ instanceId: "restart", kind: "instance", sourceId: firstSource.sourcePath }],
        id: "restart-event",
        kind: "information",
        label: "Imported source",
        payload: {},
        timestamp: 100,
      }),
    );
    initializeWorkspaceRecovery(store, "session", false);
    await retainWorkspaceRecoveryOnAcceptedShutdown();
    initializeWorkspaceRecovery(createAppStore(), "next-session", false);

    expect(getWorkspaceRecoveryCandidate()?.instances[0]?.id).toBe("restart");
    expect(getWorkspaceRecoveryCandidate()?.history?.operations).toHaveLength(1);
  });

  it("preserves source order, the active current draft, settings, and completed export history", () => {
    const store = createAppStore();
    const first = instance("first", firstSource);
    const second = instance("second", secondSource);
    store.dispatch(editingInstancesAdded([first, second]));
    store.dispatch(activeEditingInstanceChanged("second"));
    const secondSnapshot = {
      ...second.snapshot,
      audio: {
        tracks: [
          {
            enabled: true,
            metadata: {},
            streamIndex: 2,
            processing: { filters: [], volume: 0.75 },
          },
        ],
      },
    };

    store.dispatch(
      editingInstanceActivated({
        id: "second",
        loadToken: 1,
        media: mediaWithAudio(secondSource.sourcePath),
        snapshot: secondSnapshot,
      }),
    );
    store.dispatch(
      trimChanged({
        trim: { endMicros: 3_000_000, sourceDurationMicros: 5_000_000, startMicros: 1_000_000 },
      }),
    );
    store.dispatch(
      cropChanged({
        crop: { height: 0.8, width: 0.7, x: 0.1, y: 0.2 },
        resolution: { height: 864, width: 1344 },
      }),
    );
    store.dispatch(flipToggled("horizontal"));
    store.dispatch(rotationChanged(90));
    store.dispatch(
      editingInstanceGifSettingsChanged({
        id: "second",
        settings: {
          frameRate: { denominator: 1, numerator: 15 },
          gifPreset: "custom",
          paletteColors: 32,
          paletteStatsMode: "full",
          dithering: "bayer",
          resolution: { height: 360, width: 640 },
        },
      }),
    );
    store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volume: 2.5 }));
    store.dispatch(
      audioTrackSyncOffsetChanged({
        streamIndex: 2,
        syncOffset: { enabled: true, offsetMicros: -250_000 },
      }),
    );
    store.dispatch(audioTrackFiltersApplied({ filters: [broadcastNormalization], streamIndex: 2 }));
    store.dispatch(exportArgumentsChanged("-crf 18"));

    const completedAttempt = {
      ...createExportAttempt({
        capturedAt: 456,
        id: "export-1",
        output: {
          displayName: "result.mp4",
          displayPath: "C:/Exports/result.mp4",
          outputId: "out-1",
        },
        request: {
          audioTracks: [],
          mergeAudio: false,
          rotationDegrees: 0,
          sourcePath: secondSource.sourcePath,
          trim: { endMicros: 5_000_000, startMicros: 0 },
        },
        route: "fast",
        snapshot: second.snapshot,
      }),
      metrics: { durationMs: 500, fileSizeBytes: 999, progressPercent: 100 },
      state: {
        completedAt: 789,
        result: {
          displayName: "result.mp4",
          displayPath: "C:/Exports/result.mp4",
          operationId: "native-1",
        },
        status: "completed" as const,
      },
    };

    const renderingAttempt = {
      ...createExportAttempt({
        capturedAt: 500,
        id: "export-2",
        output: {
          displayName: "pending.mp4",
          displayPath: "C:/Exports/pending.mp4",
          outputId: "out-2",
        },
        request: {
          audioTracks: [],
          mergeAudio: false,
          rotationDegrees: 0,
          sourcePath: secondSource.sourcePath,
          trim: { endMicros: 5_000_000, startMicros: 0 },
        },
        route: "fast",
        snapshot: second.snapshot,
      }),
      metrics: { durationMs: null, progressPercent: 42, totalFrames: 100 },
      state: { operationId: "native-running", startedAt: 501, status: "rendering" as const },
    };

    const queuedGifAttempt = createExportAttempt({
      capturedAt: 600,
      id: "export-gif",
      output: {
        displayName: "pending.gif",
        displayPath: "C:/Exports/pending.gif",
        outputId: "out-gif",
      },
      request: {
        audioTracks: [],
        flipHorizontal: true,
        flipVertical: false,
        frameRate: { denominator: 1, numerator: 15 },
        mergeAudio: false,
        gifPreset: "custom",
        paletteColors: 32,
        paletteStatsMode: "full",
        dithering: "bayer",
        resolution: { height: 360, width: 480 },
        rotationDegrees: 90,
        sourcePath: secondSource.sourcePath,
        trim: { endMicros: 4_000_000, startMicros: 1_000_000 },
      },
      route: "gif",
      snapshot: second.snapshot,
    });

    store.dispatch(editingInstanceExportAttemptQueued({ attempt: completedAttempt, id: "second" }));
    store.dispatch(editingInstanceExportAttemptQueued({ attempt: renderingAttempt, id: "second" }));
    store.dispatch(editingInstanceExportAttemptQueued({ attempt: queuedGifAttempt, id: "second" }));

    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "session-1" });

    expect(backup.instances.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(backup.activeInstanceId).toBe("second");
    expect(backup.instances[1]?.snapshot).toMatchObject({
      audio: {
        tracks: [
          {
            enabled: true,
            metadata: {},
            streamIndex: 2,
            processing: {
              filters: [broadcastNormalization],
              volume: 2.5,
              syncOffset: { enabled: true, offsetMicros: -250_000 },
            },
          },
          { enabled: true, streamIndex: 4, processing: { filters: [], volume: 1 } },
        ],
      },
      crop: { height: 0.7, width: 0.8, x: 0, y: 0.1 },
      flipHorizontal: true,
      rotation: 90,
      trim: { endMicros: 3_000_000, startMicros: 1_000_000 },
    });
    expect(backup.instances[1]).toMatchObject({
      importedAtMicros: 1234,
      gifSettings: {
        frameRate: { denominator: 1, numerator: 15 },
        gifPreset: "custom",
        paletteColors: 32,
        paletteStatsMode: "full",
        dithering: "bayer",
        resolution: { height: 360, width: 640 },
      },
      optimizedArguments: "-crf 18",
      optimizedSettings: { resolution: { height: 1344, width: 864 } },
      sourceDurationMicros: 5_000_000,
    });
    expect(backup.instances[1]?.exportAttempts[0]).toMatchObject({
      output: { displayPath: "C:/Exports/result.mp4" },
      state: { result: { displayPath: "C:/Exports/result.mp4" }, status: "completed" },
    });
    expect(backup.instances[1]?.exportAttempts[1]).toMatchObject({
      metrics: { durationMs: null, progressPercent: 0, totalFrames: 100 },
      state: { status: "canceled" },
    });
    expect(backup.instances[1]?.exportAttempts[1]?.state).not.toHaveProperty("operationId");
    expect(backup.instances[1]?.exportAttempts[2]).toMatchObject({
      request: {
        flipHorizontal: true,
        frameRate: { denominator: 1, numerator: 15 },
        gifPreset: "custom",
        paletteColors: 32,
        paletteStatsMode: "full",
        dithering: "bayer",
        resolution: { height: 360, width: 480 },
        rotationDegrees: 90,
        trim: { endMicros: 4_000_000, startMicros: 1_000_000 },
      },
      route: "gif",
      state: { status: "canceled" },
    });
    expect(backup.instances[1]).not.toHaveProperty("media");
    expect(backup.instances[1]?.snapshot.source).toEqual(secondSource);
  });

  it("promotes only a valid abnormal-session backup and leaves the candidate frozen", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("first")]));
    const oldBackup = createWorkspaceRecoveryBackup(store.getState(), {
      sessionId: "crashed-session",
    });

    localStorage.setItem(CURRENT_KEY, JSON.stringify(oldBackup));

    initializeWorkspaceRecovery(store, "new-session", true);
    const candidate = getWorkspaceRecoveryCandidate();
    expect(candidate?.sessionId).toBe("crashed-session");
    expect(localStorage.getItem(CANDIDATE_KEY)).toBe(JSON.stringify(oldBackup));

    store.dispatch(editingInstancesAdded([instance("new", secondSource)]));
    expect(getWorkspaceRecoveryCandidate()).toEqual(candidate);
    expect(localStorage.getItem(CANDIDATE_KEY)).toBe(JSON.stringify(oldBackup));

    dismissWorkspaceRecoveryNotice();
    expect(getWorkspaceRecoveryCandidate()).toEqual(candidate);
    expect(localStorage.getItem(CANDIDATE_KEY)).toBe(JSON.stringify(oldBackup));
  });

  it("keeps the recovery data across consecutive crashes while the session has no work", () => {
    const crashedStore = createAppStore();
    crashedStore.dispatch(editingInstancesAdded([instance("first")]));
    const oldBackup = createWorkspaceRecoveryBackup(crashedStore.getState(), {
      sessionId: "crashed-session",
    });

    localStorage.setItem(CURRENT_KEY, JSON.stringify(oldBackup));

    for (const sessionId of ["second-session", "third-session", "fourth-session"]) {
      const idleStore = createAppStore();
      initializeWorkspaceRecovery(idleStore, sessionId, true);

      expect(getWorkspaceRecoveryCandidate()?.sessionId).toBe("crashed-session");
      expect(localStorage.getItem(CANDIDATE_KEY)).toBe(JSON.stringify(oldBackup));
      expect(localStorage.getItem(CURRENT_KEY)).toBe(JSON.stringify(oldBackup));
    }
  });

  it("supersedes the previous recovery data once a new session produces work", () => {
    const crashedStore = createAppStore();
    crashedStore.dispatch(editingInstancesAdded([instance("first")]));
    localStorage.setItem(
      CURRENT_KEY,
      JSON.stringify(
        createWorkspaceRecoveryBackup(crashedStore.getState(), { sessionId: "crashed-session" }),
      ),
    );

    const resumedStore = createAppStore();
    initializeWorkspaceRecovery(resumedStore, "resumed-session", true);
    resumedStore.dispatch(editingInstancesAdded([instance("new", secondSource)]));

    initializeWorkspaceRecovery(createAppStore(), "next-session", true);

    expect(getWorkspaceRecoveryCandidate()?.sessionId).toBe("resumed-session");
    expect(getWorkspaceRecoveryCandidate()?.instances.map(({ id }) => id)).toEqual(["new"]);
  });

  it("does not resurrect old recovery data after the resumed workspace is emptied", () => {
    const crashedStore = createAppStore();
    crashedStore.dispatch(editingInstancesAdded([instance("first")]));
    localStorage.setItem(
      CURRENT_KEY,
      JSON.stringify(
        createWorkspaceRecoveryBackup(crashedStore.getState(), { sessionId: "crashed-session" }),
      ),
    );

    const resumedStore = createAppStore();
    initializeWorkspaceRecovery(resumedStore, "resumed-session", true);
    resumedStore.dispatch(editingInstancesAdded([instance("first")]));
    resumedStore.dispatch(editingInstancesClosed(["first"]));

    initializeWorkspaceRecovery(createAppStore(), "next-session", true);

    expect(getWorkspaceRecoveryCandidate()).toBeNull();
    expect(localStorage.getItem(CANDIDATE_KEY)).toBeNull();
  });

  it("migrates stage-based processing in recovered snapshots and stored export requests", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("filtered-track")]));
    const backup = createWorkspaceRecoveryBackup(store.getState(), {
      sessionId: "crashed-session",
    });

    const legacyProcessing = {
      gainDb: 0,
      effects: [
        { ceilingDb: -1, stage: "finalProtection", type: "limiter" },
        { preset: "medium", stage: "cleanup", type: "noiseReduction" },
        { cutoffHz: 80, stage: "cleanup", type: "highPass" },
      ],
    };

    const legacyBackup = JSON.parse(JSON.stringify(backup));
    legacyBackup.instances[0].snapshot.audio.tracks = [
      { enabled: true, metadata: {}, streamIndex: 2, processing: legacyProcessing },
    ];
    legacyBackup.instances[0].exportAttempts = [
      {
        ...createExportAttempt({
          capturedAt: 1,
          id: "legacy-attempt",
          output: { displayName: "a.mp4", displayPath: "C:/a.mp4", outputId: "out" },
          request: {
            audioTracks: [],
            mergeAudio: false,
            rotationDegrees: 0,
            sourcePath: firstSource.sourcePath,
            trim: { endMicros: 5_000_000, startMicros: 0 },
          },
          route: "fast",
          snapshot: backup.instances[0]!.snapshot,
        }),
        request: {
          audioTracks: [
            {
              loudnessAnalysis: { integratedLufs: -20 },
              processing: { gainDb: 3, loudnessNormalization: "streaming" },
              streamIndex: 2,
            },
          ],
          mergeAudio: false,
          rotationDegrees: 0,
          sourcePath: firstSource.sourcePath,
          trim: { endMicros: 5_000_000, startMicros: 0 },
        },
      },
    ];
    localStorage.setItem(CURRENT_KEY, JSON.stringify(legacyBackup));

    initializeWorkspaceRecovery(store, "new-session", true);

    const recovered = getWorkspaceRecoveryCandidate()?.instances[0];
    expect(recovered?.snapshot.audio.tracks[0]?.processing).toEqual({
      filters: [
        { enabled: true, cutoffHz: 80, id: "legacy-1", type: "highPass" },
        {
          enabled: true,
          id: "legacy-2",
          noiseFloorDb: -35,
          reductionDb: 12,
          type: "noiseReduction",
        },
        {
          enabled: true,
          attackMs: 5,
          ceilingDb: -1,
          id: "legacy-3",
          releaseMs: 50,
          type: "limiter",
        },
      ],
      volume: 1,
    });
    expect(recovered?.exportAttempts[0]?.request.audioTracks).toEqual([
      {
        filters: [
          {
            enabled: true,
            id: "legacy-1",
            loudnessRangeLu: 11,
            maxTruePeakDb: -1.5,
            targetLufs: -16,
            type: "loudnessNormalization",
          },
        ],
        loudnessMeasurements: [{ filterId: "legacy-1", integratedLufs: -20 }],
        streamIndex: 2,
        volume: 1,
      },
    ]);
  });

  it("migrates root-level metadata from recovered snapshots and queued export snapshots", () => {
    const store = createAppStore();
    const baseInstance = instance("legacy-metadata");
    const snapshot = {
      ...baseInstance.snapshot,
      audio: {
        ...baseInstance.snapshot.audio,
        tracks: [
          {
            enabled: true,
            metadata: { isDefault: true, language: "rus", title: "Commentary" },
            processing: { filters: [], volume: 1 },
            streamIndex: 2,
          },
        ],
      },
    };

    const queuedAttempt = createExportAttempt({
      capturedAt: 10,
      id: "legacy-queued-export",
      output: { displayName: "output.mp4", displayPath: "C:/output.mp4", outputId: "output" },
      request: {
        audioTracks: [],
        audioMetadata: [{ isDefault: true, language: "rus", streamIndex: 2, title: "Commentary" }],
        mergeAudio: false,
        rotationDegrees: 0,
        sourcePath: firstSource.sourcePath,
        trim: { endMicros: 1_000_000, startMicros: 0 },
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(editingInstancesAdded([{ ...baseInstance, snapshot }]));
    store.dispatch(
      editingInstanceExportAttemptQueued({ attempt: queuedAttempt, id: "legacy-metadata" }),
    );
    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "old-session" });

    type LegacySnapshot = { audio: { tracks: Array<Record<string, unknown>> } };
    type LegacyInstance = {
      exportAttempts: Array<{ snapshot: LegacySnapshot }>;
      snapshot: LegacySnapshot;
    };
    const legacyInstances = structuredClone(backup.instances) as unknown as LegacyInstance[];

    for (const savedInstance of legacyInstances) {
      const snapshots = [
        savedInstance.snapshot,
        ...savedInstance.exportAttempts.map(({ snapshot: attemptSnapshot }) => attemptSnapshot),
      ];

      for (const savedSnapshot of snapshots) {
        for (const track of savedSnapshot.audio.tracks) {
          const metadata = track.metadata;
          if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
            Object.assign(track, metadata);
          }
          delete track.metadata;
        }
      }
    }

    localStorage.setItem(CURRENT_KEY, JSON.stringify({ ...backup, instances: legacyInstances }));
    initializeWorkspaceRecovery(store, "new-session", true);

    const recoveredInstance = getWorkspaceRecoveryCandidate()?.instances[0];
    expect(recoveredInstance?.snapshot.audio.tracks[0]).toMatchObject({
      metadata: { isDefault: true, language: "rus", title: "Commentary" },
    });
    expect(recoveredInstance?.exportAttempts[0]?.snapshot.audio.tracks[0]).toMatchObject({
      metadata: { isDefault: true, language: "rus", title: "Commentary" },
    });
  });

  it("does not expose malformed or incompatible storage", () => {
    const store = createAppStore();
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ version: 99, instances: [] }));

    initializeWorkspaceRecovery(store, "new-session", true);

    expect(getWorkspaceRecoveryCandidate()).toBeNull();
    expect(localStorage.getItem(CANDIDATE_KEY)).toBeNull();
  });

  it("rejects GIF recovery settings with the wrong JSON primitive type", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("malformed-gif-settings")]));
    const backup = createWorkspaceRecoveryBackup(store.getState(), {
      sessionId: "crashed-session",
    });

    const malformedValues = [
      { gifPreset: ["balanced"] },
      { paletteColors: "32" },
      { paletteStatsMode: ["full"] },
      { dithering: ["bayer"] },
    ];

    for (const malformed of malformedValues) {
      localStorage.clear();
      const malformedBackup = structuredClone(backup) as unknown as {
        instances: Array<{ gifSettings: Record<string, unknown> }>;
      };

      Object.assign(malformedBackup.instances[0]!.gifSettings, malformed);
      localStorage.setItem(CURRENT_KEY, JSON.stringify(malformedBackup));

      initializeWorkspaceRecovery(createAppStore(), "new-session", true);

      expect(getWorkspaceRecoveryCandidate()).toBeNull();
      expect(localStorage.getItem(CANDIDATE_KEY)).toBeNull();
    }
  });
});
