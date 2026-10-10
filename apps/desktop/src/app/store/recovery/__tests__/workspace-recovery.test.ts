import { beforeEach, describe, expect, it } from "vitest";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  audioMergeToggled,
  audioTrackGainChanged,
  audioTrackLoudnessNormalizationChanged,
} from "@/app/store/slices/audio-slice";
import { cropChanged, flipToggled, rotationChanged } from "@/app/store/slices/crop-slice";
import {
  activeEditingInstanceChanged,
  editingInstanceExportAttemptQueued,
  editingInstanceGifSettingsChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { exportArgumentsChanged } from "@/app/store/slices/export-presets-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource, mediaWithAudio, secondSource } from "@/test/source.fixtures";

import {
  createWorkspaceRecoveryBackup,
  dismissWorkspaceRecoveryNotice,
  getWorkspaceRecoveryCandidate,
  initializeWorkspaceRecovery,
} from "../workspace-recovery";

const CURRENT_KEY = "easytrim:workspace-recovery:current";
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
    snapshot: createDefaultEditorSnapshot(source, false),
    sourceAvailability: "available" as const,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("workspace recovery contract", () => {
  it("preserves source order, the active current draft, settings, and completed export history", () => {
    const store = createAppStore();
    const first = instance("first", firstSource);
    const second = instance("second", secondSource);
    store.dispatch(editingInstancesAdded([first, second]));
    store.dispatch(activeEditingInstanceChanged("second"));
    const secondSnapshot = {
      ...second.snapshot,
      audio: {
        mergeAudio: false,
        tracks: [{ enabled: true, metadata: {}, streamIndex: 2, processing: { gainDb: -2.5 } }],
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
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -4 }));
    store.dispatch(audioTrackLoudnessNormalizationChanged({ preset: "broadcast", streamIndex: 2 }));
    store.dispatch(audioMergeToggled());
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
        mergeAudio: true,
        tracks: [
          {
            enabled: true,
            metadata: {},
            streamIndex: 2,
            processing: { gainDb: -4, loudnessNormalization: "broadcast" },
          },
          { enabled: true, streamIndex: 4, processing: { gainDb: 0 } },
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

  it("recovers workspaces with shared signal effects, including high-pass processing", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("filtered-track")]));
    const backup = createWorkspaceRecoveryBackup(store.getState(), {
      sessionId: "crashed-session",
    });

    const recoveredInstance = backup.instances[0]!;
    recoveredInstance.snapshot = {
      ...recoveredInstance.snapshot,
      audio: {
        ...recoveredInstance.snapshot.audio,
        tracks: [
          {
            enabled: true,
            metadata: {},
            streamIndex: 2,
            processing: {
              gainDb: 0,
              effects: [
                { cutoffHz: 80, stage: "cleanup", type: "highPass" },
                { preset: "medium", stage: "cleanup", type: "noiseReduction" },
                { ceilingDb: -1, stage: "finalProtection", type: "limiter" },
              ],
            },
          },
        ],
      },
    };
    localStorage.setItem(CURRENT_KEY, JSON.stringify(backup));

    initializeWorkspaceRecovery(store, "new-session", true);

    expect(
      getWorkspaceRecoveryCandidate()?.instances[0]?.snapshot.audio.tracks[0]?.processing,
    ).toEqual({
      gainDb: 0,
      effects: [
        { cutoffHz: 80, stage: "cleanup", type: "highPass" },
        { preset: "medium", stage: "cleanup", type: "noiseReduction" },
        { ceilingDb: -1, stage: "finalProtection", type: "limiter" },
      ],
    });
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
            processing: { gainDb: 0 },
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
