import { describe, expect, it, vi } from "vitest";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  applyHistoryPosition,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
} from "@/app/store/integration/workspace-history";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackDefaultChanged,
  audioTrackFiltersApplied,
  audioTrackMetadataChanged,
  audioTrackSyncOffsetChanged,
  audioTrackToggled,
  audioTrackVolumeChanged,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { chapterAdded, chapterDeleted, chapterUpdated } from "@/app/store/slices/chapters-slice";
import { cropChanged, flipToggled, rotationChanged } from "@/app/store/slices/crop-slice";
import {
  editingInstancesAdded,
  editingInstanceSnapshotUpdated,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import {
  historyInteractionEnded,
  historyInteractionStarted,
  selectWorkspaceHistory,
} from "@/app/store/slices/workspace-history-slice";
import { createAppStore } from "@/app/store/store";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { createAudioFilter, serializeAudioTrackSettings } from "@/domain/audio-processing";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

function setup(ids = ["instance-1"]) {
  const store = createAppStore();
  const media = mediaWithAudio(firstSource.sourcePath);
  store.dispatch(sourceSelected({ source: firstSource, loadToken: 1 }));
  store.dispatch(sourceReady({ loadToken: 1, media }));
  const instances: EditingInstance[] = ids.map((id) => ({
    exportAttempts: [],
    id,
    media,
    origin: "source-import",
    sourceAvailability: "available",
    snapshot: createDefaultEditorSnapshot(firstSource),
  }));

  store.dispatch(editingInstancesAdded(instances));
  store.dispatch(
    editingInstanceActivated({
      id: ids[0]!,
      loadToken: 1,
      media,
      snapshot: instances[0]!.snapshot,
    }),
  );
  store.dispatch(sourceReady({ loadToken: 1, media, snapshot: instances[0]!.snapshot }));
  return store;
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("workspace history editor integration", () => {
  it("undoes and redoes offset placement without changing the signal chain", async () => {
    const store = setup();
    const syncOffset = { enabled: true, offsetMicros: 750_000 };
    store.dispatch(audioTrackSyncOffsetChanged({ streamIndex: 2, syncOffset }));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().audio.tracks[0]?.processing.syncOffset).toBeUndefined();
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().audio.tracks[0]?.processing.syncOffset).toEqual(syncOffset);
    expect(store.getState().audio.tracks[0]?.processing.filters).toEqual([]);
    expect(store.getState().audio.tracks[1]?.processing.syncOffset).toBeUndefined();
  });

  it("records trim and restores it while preserving unrelated runtime state", async () => {
    const store = setup();
    store.dispatch(
      trimChanged({
        trim: { startMicros: 100_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await flush();
    expect(selectWorkspaceHistory(store.getState()).operations[0]?.label).toBe("Adjust trim");
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 5_000_000 });
    expect(store.getState().editingInstances.entities["instance-1"]?.snapshot.trim).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
    });
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().trim.value?.startMicros).toBe(100_000);
  });

  it("restores crop, rotation, and flips through the existing transform reducers", async () => {
    const store = setup();
    store.dispatch(
      cropChanged({
        crop: { x: 0.1, y: 0.2, width: 0.8, height: 0.7 },
        resolution: { width: 1536, height: 756 },
      }),
    );
    await flush();
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().crop.value).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().crop.value).toEqual({ x: 0.1, y: 0.2, width: 0.8, height: 0.7 });
    store.dispatch(rotationChanged(90));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    store.dispatch(flipToggled("horizontal"));
    await flush();
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().crop.flipHorizontal).toBe(false);
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().crop.rotationDegrees).toBe(0);
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().crop.rotationDegrees).toBe(90);
  });

  it("records committed audio settings and replays audio cache invalidation", async () => {
    const store = setup();
    store.dispatch(audioTrackActivityVisibilityToggled({ streamIndex: 2 }));
    store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volume: 1.5 }));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(
      selectAudioTracks(store.getState()).find((track) => track.streamIndex === 2)?.processing
        .volume,
    ).toBe(1);
    expect(
      selectAudioTracks(store.getState()).find((track) => track.streamIndex === 2)?.activityVisible,
    ).toBe(false);
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(
      selectAudioTracks(store.getState()).find((track) => track.streamIndex === 2)?.processing
        .volume,
    ).toBe(1.5);
    store.dispatch(audioTrackDefaultChanged({ streamIndex: 4 }));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    store.dispatch(audioTrackToggled({ streamIndex: 4 }));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    store.dispatch(
      audioTrackMetadataChanged({ streamIndex: 4, title: "Commentary", language: "fra" }),
    );
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    store.dispatch(
      audioTrackFiltersApplied({ streamIndex: 2, filters: [createAudioFilter("gain", "gain-1")] }),
    );
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    expect(
      selectWorkspaceHistory(store.getState()).operations.map((operation) => operation.label),
    ).toEqual([
      "Adjust audio volume",
      "Set default audio track",
      "Change audio track",
      "Edit audio track metadata",
      "Edit audio filters",
    ]);
    expect(JSON.stringify(selectWorkspaceHistory(store.getState()))).not.toContain("waveform");
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(
      selectAudioTracks(store.getState()).find((track) => track.streamIndex === 2)?.processing
        .filters,
    ).toEqual([]);
  });

  it("restores complete active audio metadata when switching defaults backward and forward", async () => {
    const store = setup();
    const capture = () => selectAudioTracks(store.getState()).map(serializeAudioTrackSettings);
    const initial = capture();
    store.dispatch(audioTrackActivityVisibilityToggled({ streamIndex: 4 }));
    store.dispatch(audioTrackDefaultChanged({ streamIndex: 4 }));
    await flush();
    const surroundDefault = capture();
    store.dispatch(audioTrackDefaultChanged({ streamIndex: 2 }));
    await flush();
    const stereoDefault = capture();
    const expectRestored = (expected: ReturnType<typeof capture>) => {
      expect(capture()).toEqual(expected);
      expect(
        store.getState().editingInstances.entities["instance-1"]?.snapshot.audio.tracks,
      ).toEqual(expected);
      expect(selectAudioTracks(store.getState())[1]?.activityVisible).toBe(false);
      store.dispatch(commitActiveEditingInstanceDraft());
      expect(
        store.getState().editingInstances.entities["instance-1"]?.snapshot.audio.tracks,
      ).toEqual(expected);
    };

    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expectRestored(surroundDefault);
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expectRestored(initial);
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expectRestored(surroundDefault);
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expectRestored(stereoDefault);
    expect(await store.dispatch(applyHistoryPosition(0))).toBe(true);
    expectRestored(initial);
    expect(await store.dispatch(applyHistoryPosition(2))).toBe(true);
    expectRestored(stereoDefault);
    expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(2);
  });

  it("restores grouped audio selection and cleared metadata alongside the saved default", async () => {
    const store = setup();
    const capture = () => selectAudioTracks(store.getState()).map(serializeAudioTrackSettings);
    const initial = capture();
    store.dispatch(
      historyInteractionStarted({ id: "audio-selection", label: "Edit audio", timestamp: 1 }),
    );
    store.dispatch(audioTrackDefaultChanged({ streamIndex: 4 }));
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    store.dispatch(
      audioTrackMetadataChanged({ streamIndex: 4, title: undefined, language: "fra" }),
    );
    store.dispatch(historyInteractionEnded());
    await flush();
    const edited = capture();

    for (let iteration = 0; iteration < 2; iteration++) {
      expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
      expect(capture()).toEqual(initial);
      expect(
        store.getState().editingInstances.entities["instance-1"]?.snapshot.audio.tracks,
      ).toEqual(initial);
      expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
      expect(capture()).toEqual(edited);
      expect(
        store.getState().editingInstances.entities["instance-1"]?.snapshot.audio.tracks,
      ).toEqual(edited);
    }
  });

  it("records chapter add, edit, and delete and restores each transition", async () => {
    const store = setup();
    const chapter = {
      endMicros: 2_000_000,
      id: "chapter-1",
      startMicros: 1_000_000,
      title: "Intro",
    };

    store.dispatch(chapterAdded(chapter));
    await flush();
    store.dispatch(chapterUpdated({ ...chapter, title: "Opening" }));
    await flush();
    store.dispatch(chapterDeleted(chapter.id));
    await flush();
    expect(
      selectWorkspaceHistory(store.getState()).operations.map((operation) => operation.label),
    ).toEqual(["Add chapter", "Edit chapter", "Delete chapter"]);
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().chapters.items).toEqual([{ ...chapter, title: "Opening" }]);
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().chapters.items).toEqual([chapter]);
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().chapters.items[0]?.title).toBe("Opening");
  });

  it("groups repeated drag updates between explicit interaction boundaries", async () => {
    const store = setup();
    store.dispatch(historyInteractionStarted({ id: "drag-1", label: "Adjust trim", timestamp: 1 }));
    store.dispatch(
      trimChanged({
        trim: { startMicros: 10_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(
      trimChanged({
        trim: { startMicros: 20_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(0);
    store.dispatch(historyInteractionEnded());
    const operations = selectWorkspaceHistory(store.getState()).operations;
    expect(operations).toHaveLength(1);
    expect(operations[0]?.kind === "state" && operations[0].changes[0]?.before).toEqual({
      present: true,
      value: { endMicros: 5_000_000, startMicros: 0 },
    });
    expect(operations[0]?.kind === "state" && operations[0].changes[0]?.after).toEqual({
      present: true,
      value: { endMicros: 4_000_000, startMicros: 20_000 },
    });
  });

  it("drops a coalesced keyboard adjustment when it returns to the baseline", async () => {
    const store = setup();
    store.dispatch(rotationChanged(90));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    store.dispatch(rotationChanged(0));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    expect(selectWorkspaceHistory(store.getState())).toMatchObject({ operations: [], position: 0 });
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(false);
  });

  it("invalidates redo before coalescing a trim edit after undo", async () => {
    const store = setup();
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);

    try {
      store.dispatch(
        trimChanged({
          trim: { startMicros: 10_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
        }),
      );
      await flush();

      store.dispatch(
        historyInteractionStarted({ id: "drag-2", label: "Adjust trim", timestamp: 1_250 }),
      );
      store.dispatch(
        trimChanged({
          trim: { startMicros: 20_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
        }),
      );
      store.dispatch(historyInteractionEnded());
      expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(2);
      expect(selectWorkspaceHistory(store.getState()).position).toBe(2);

      expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
      expect(selectWorkspaceHistory(store.getState()).position).toBe(1);
      expect(store.getState().trim.value?.startMicros).toBe(10_000);

      clock.mockReturnValue(1_300);
      store.dispatch(
        trimChanged({
          trim: { startMicros: 30_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
        }),
      );
      await flush();

      const history = selectWorkspaceHistory(store.getState());
      expect(history).toMatchObject({ operations: [{ label: "Adjust trim" }], position: 1 });
      expect(
        history.operations[0]?.kind === "state" && history.operations[0].changes[0],
      ).toMatchObject({
        before: { present: true, value: { startMicros: 0, endMicros: 5_000_000 } },
        after: { present: true, value: { startMicros: 30_000, endMicros: 4_000_000 } },
      });
      expect(await store.dispatch(redoWorkspaceHistory())).toBe(false);
      expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
      expect(store.getState().trim.value?.startMicros).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });

  it("uses one timeline across instances of the same source", async () => {
    const store = setup(["instance-1", "instance-2"]);
    store.dispatch(
      trimChanged({
        trim: { startMicros: 50_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    store.dispatch(
      editingInstanceActivated({
        id: "instance-2",
        loadToken: 2,
        media: mediaWithAudio(firstSource.sourcePath),
        snapshot: store.getState().editingInstances.entities["instance-2"]!.snapshot,
      }),
    );
    store.dispatch(
      sourceReady({
        loadToken: 2,
        media: mediaWithAudio(firstSource.sourcePath),
        snapshot: store.getState().editingInstances.entities["instance-2"]!.snapshot,
      }),
    );
    store.dispatch(rotationChanged(90));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    const history = selectWorkspaceHistory(store.getState());
    expect(history.operations).toHaveLength(2);
    expect(
      history.operations.every(
        (operation) =>
          operation.kind === "state" && operation.changes[0]?.target.kind === "instance",
      ),
    ).toBe(true);
    expect(
      history.operations[0]?.kind === "state" &&
        history.operations[0].changes[0]?.target.kind === "instance" &&
        history.operations[0].changes[0].target.instanceId,
    ).toBe("instance-1");
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities["instance-2"]?.snapshot.rotation).toBe(0);
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities["instance-1"]?.snapshot.trim).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
    });
  });

  it("rejects replay when an instance no longer matches its recorded source identity", async () => {
    const store = setup();
    store.dispatch(rotationChanged(90));
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    const instance = store.getState().editingInstances.entities["instance-1"]!;
    store.dispatch(
      editingInstanceSnapshotUpdated({
        id: instance.id,
        snapshot: {
          ...instance.snapshot,
          source: { ...instance.snapshot.source, sourcePath: "C:/Media/replaced.mp4" },
        },
      }),
    );
    const position = selectWorkspaceHistory(store.getState()).position;
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(false);
    expect(selectWorkspaceHistory(store.getState()).position).toBe(position);
  });
});
