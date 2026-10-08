import { act, renderHook } from "@testing-library/react";
import { type PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { audioTrackGainChanged, audioTrackToggled } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { useAudioPlaybackRuntime } from "../useAudioPlaybackRuntime";

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
});
