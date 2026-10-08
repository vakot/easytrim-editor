import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackGainChanged,
  audioTrackPreviewReady,
  audioTrackPreviewStarted,
  audioTrackProcessingChanged,
  audioTrackToggled,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { useAudioPlaybackRuntime } from "../useAudioPlaybackRuntime";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function createStore() {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  store.dispatch(audioTrackToggled({ streamIndex: 4 }));
  return store;
}

function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}

function renderAudioPlaybackRuntime(store: ReturnType<typeof createStore>) {
  const video = document.createElement("video");
  const videoRef = { current: video };

  const hook = renderHook(
    () =>
      useAudioPlaybackRuntime({
        activeInstanceId: null,
        isPreviewReady: false,
        playbackRate: 1,
        previewKey: null,
        videoRef,
      }),
    { wrapper: createWrapper(store) },
  );

  return { ...hook, video };
}

function createAudioNode() {
  return {
    connect: vi.fn((destination: unknown) => destination),
    disconnect: vi.fn(),
    gain: {
      cancelScheduledValues: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
      value: 1,
    },
  };
}

class TestAudioContext {
  static instance: TestAudioContext;

  destination = createAudioNode();
  currentTime = 0;
  createGain = vi.fn(() => createAudioNode());
  createMediaElementSource = vi.fn((element: HTMLMediaElement) => ({
    ...createAudioNode(),
    element,
  }));
  createChannelSplitter = vi.fn(() => createAudioNode());
  createAnalyser = vi.fn(() => createAudioNode());
  createWaveShaper = vi.fn(() => createAudioNode());
  close = vi.fn(async () => undefined);

  constructor() {
    TestAudioContext.instance = this;
  }
}

describe("useAudioPlaybackRuntime", () => {
  it("restores the latest committed gain and clears the live override", () => {
    const store = createStore();
    const { result, video } = renderAudioPlaybackRuntime(store);

    act(() => {
      result.current.setLiveAudioTrackGain(2, 6);
      store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -3 }));
      result.current.clearLiveAudioTrackGain(2);
    });

    expect(video.volume).toBeCloseTo(10 ** (-3 / 20));
  });

  it("restores muted tracks to silence and clears their live override", () => {
    const store = createStore();
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -6 }));
    const { result, video } = renderAudioPlaybackRuntime(store);

    act(() => {
      result.current.setLiveAudioTrackGain(2, 6);
      store.dispatch(audioTrackToggled({ streamIndex: 2 }));
      result.current.clearLiveAudioTrackGain(2);
    });

    expect(video.volume).toBe(0);
  });

  it("restores a track unmuted in Redux even when the runtime render is stale", () => {
    const store = createStore();
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -6 }));
    const { result, video } = renderAudioPlaybackRuntime(store);

    act(() => {
      result.current.setLiveAudioTrackGain(2, 6);
      store.dispatch(audioTrackToggled({ streamIndex: 2 }));
      result.current.clearLiveAudioTrackGain(2);
    });

    expect(video.volume).toBeCloseTo(10 ** (-6 / 20));
  });

  it("reconnects the native route after disabling normalization on one enabled track", () => {
    vi.stubGlobal("AudioContext", TestAudioContext);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const store = createStore();
    const { video } = renderAudioPlaybackRuntime(store);
    const context = TestAudioContext.instance;
    const nativeSource = context.createMediaElementSource.mock.results[0]?.value;
    const nativeGain = context.createGain.mock.results[2]?.value;
    const audioMix = context.createGain.mock.results[0]?.value;
    const normalizedProcessing = { gainDb: 0, loudnessNormalization: "streaming" as const };

    expect(nativeSource?.connect).toHaveBeenCalled();

    act(() => {
      store.dispatch(
        audioTrackProcessingChanged({ processing: normalizedProcessing, streamIndex: 2 }),
      );
      store.dispatch(audioTrackPreviewStarted({ operationId: "normalization", streamIndex: 2 }));
      store.dispatch(
        audioTrackPreviewReady({
          descriptor: {
            mediaToken: 1,
            previewRevision: 1,
            processing: normalizedProcessing,
            streamIndex: 2,
            url: "media://normalized-audio",
          },
          operationId: "normalization",
        }),
      );
    });

    expect(nativeSource?.disconnect).toHaveBeenCalled();
    expect(video.volume).toBe(0);

    act(() => {
      store.dispatch(audioTrackProcessingChanged({ processing: { gainDb: 0 }, streamIndex: 2 }));
    });

    expect(nativeSource?.connect).toHaveBeenCalledTimes(2);
    expect(nativeSource?.connect.mock.calls.at(-1)?.[0]).toBe(nativeGain);
    expect(nativeGain?.connect).toHaveBeenCalledTimes(2);
    expect(nativeGain?.connect.mock.calls.at(-1)?.[0]).toBe(audioMix);
    expect(nativeGain?.gain.value).toBe(1);
    expect(video.volume).toBe(1);
  });
});
