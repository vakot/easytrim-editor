import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  releaseAudioPlaybackPreview: vi.fn(async () => undefined),
  sessions: [] as Array<{
    onTrackStatus: (streamIndex: number, tag: number | undefined, status: string) => void;
    setTracks: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  releaseAudioPlaybackPreview: mocks.releaseAudioPlaybackPreview,
}));

vi.mock("../../lib/audio-playback-session", () => ({
  AudioPlaybackSession: class {
    readonly setTracks = vi.fn();
    readonly close = vi.fn();
    readonly setDuration = vi.fn();
    readonly setOutputGain = vi.fn();
    readonly setPlaybackRate = vi.fn();
    readonly setMono = vi.fn();
    readonly registerPlaybackErrorObserver = vi.fn(() => () => undefined);

    constructor(
      _sourcePath: string,
      readonly onTrackStatus: (
        streamIndex: number,
        tag: number | undefined,
        status: string,
      ) => void,
    ) {
      mocks.sessions.push(this);
    }
  },
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioFilterPreviewChanged,
  audioFilterPreviewEnded,
  audioFilterPreviewStarted,
  audioTrackFiltersApplied,
  selectAudioFilterPreviewStatus,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import type { AudioFilter } from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { useAudioPlaybackRuntime } from "../useAudioPlaybackRuntime";

const gain = (gainDb: number): AudioFilter => ({ enabled: true, gainDb, id: "g", type: "gain" });

function renderRuntime() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  const hook = renderHook(() => useAudioPlaybackRuntime(), { wrapper });
  const lastTracks = () =>
    mocks.sessions.at(-1)!.setTracks.mock.lastCall![0] as Array<Record<string, unknown>>;

  return { hook, lastTracks, store };
}

beforeEach(() => {
  mocks.sessions.length = 0;
  mocks.releaseAudioPlaybackPreview.mockClear();
  vi.stubGlobal("AudioContext", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAudioPlaybackRuntime", () => {
  it("plays the draft, reports its playback for the current revision, and releases it on Cancel", () => {
    const { lastTracks, store } = renderRuntime();
    act(() => {
      store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
      store.dispatch(audioFilterPreviewChanged({ filters: [gain(6)], id: "preview" }));
    });
    expect(lastTracks().find((track) => track.streamIndex === 2)).toMatchObject({
      preview: true,
      selection: { filters: [gain(6)], streamIndex: 2 },
      tag: 1,
    });

    const session = mocks.sessions.at(-1)!;
    act(() => session.onTrackStatus(2, 1, "updating"));
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("updating");
    act(() => session.onTrackStatus(2, 0, "ready"));
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("updating");
    act(() => session.onTrackStatus(2, 1, "ready"));
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("active");
    expect(mocks.releaseAudioPlaybackPreview).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(audioFilterPreviewEnded({ id: "preview" }));
    });
    expect(lastTracks().find((track) => track.streamIndex === 2)).not.toHaveProperty("preview");

    // The draft keeps playing until the committed processing replaces it.
    act(() => session.onTrackStatus(2, undefined, "updating"));
    expect(mocks.releaseAudioPlaybackPreview).not.toHaveBeenCalled();
    act(() => session.onTrackStatus(2, undefined, "ready"));
    expect(mocks.releaseAudioPlaybackPreview).toHaveBeenCalledOnce();
    expect(mocks.releaseAudioPlaybackPreview).toHaveBeenCalledWith(firstSource.sourcePath, 2, {
      filters: [],
      streamIndex: 2,
    });
  });

  it("keeps the applied draft's native audio when Apply ends the preview", () => {
    const { store } = renderRuntime();
    act(() => {
      store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
      store.dispatch(audioFilterPreviewChanged({ filters: [gain(6)], id: "preview" }));
    });
    act(() => {
      store.dispatch(audioTrackFiltersApplied({ filters: [gain(6)], streamIndex: 2 }));
    });
    act(() => mocks.sessions.at(-1)!.onTrackStatus(2, undefined, "ready"));
    expect(mocks.releaseAudioPlaybackPreview).toHaveBeenCalledOnce();
    expect(mocks.releaseAudioPlaybackPreview).toHaveBeenCalledWith(firstSource.sourcePath, 2, {
      filters: [gain(6)],
      streamIndex: 2,
    });
  });

  it("reports a preview ready when there is no audio output to render it", () => {
    vi.stubGlobal("AudioContext", undefined);
    const { store } = renderRuntime();
    act(() => {
      store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
      store.dispatch(audioFilterPreviewChanged({ filters: [gain(6)], id: "preview" }));
    });
    expect(mocks.sessions).toHaveLength(0);
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("active");
  });
});
