import { beforeEach, describe, expect, it } from "vitest";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  audioMergeToggled,
  audioTrackVolumeChanged,
  masterVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { cropChanged, flipToggled, rotationChanged } from "@/app/store/slices/crop-slice";
import {
  activeEditingInstanceChanged,
  editingInstanceExportAttemptQueued,
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
    optimizedSettings: { frameRate: undefined, resolution: { height: 720, width: 1280 } },
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
        master: { enabled: true, volumePercent: 80 },
        mergeAudio: false,
        tracks: [{ enabled: true, streamIndex: 2, volumePercent: 75 }],
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
    store.dispatch(masterVolumeChanged({ volumePercent: 64 }));
    store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volumePercent: 35 }));
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

    store.dispatch(editingInstanceExportAttemptQueued({ attempt: completedAttempt, id: "second" }));
    store.dispatch(editingInstanceExportAttemptQueued({ attempt: renderingAttempt, id: "second" }));

    const backup = createWorkspaceRecoveryBackup(store.getState(), { sessionId: "session-1" });

    expect(backup.instances.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(backup.activeInstanceId).toBe("second");
    expect(backup.instances[1]?.snapshot).toMatchObject({
      audio: {
        master: { enabled: true, volumePercent: 64 },
        mergeAudio: true,
        tracks: [
          { enabled: true, streamIndex: 2, volumePercent: 35 },
          { enabled: true, streamIndex: 4, volumePercent: 50 },
        ],
      },
      crop: { height: 0.7, width: 0.8, x: 0, y: 0.1 },
      flipHorizontal: true,
      rotation: 90,
      trim: { endMicros: 3_000_000, startMicros: 1_000_000 },
    });
    expect(backup.instances[1]).toMatchObject({
      importedAtMicros: 1234,
      optimizedArguments: "-crf 18",
      optimizedSettings: { resolution: { height: 1344, width: 864 } },
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

  it("does not expose malformed or incompatible storage", () => {
    const store = createAppStore();
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ version: 99, instances: [] }));

    initializeWorkspaceRecovery(store, "new-session", true);

    expect(getWorkspaceRecoveryCandidate()).toBeNull();
    expect(localStorage.getItem(CANDIDATE_KEY)).toBeNull();
  });
});
