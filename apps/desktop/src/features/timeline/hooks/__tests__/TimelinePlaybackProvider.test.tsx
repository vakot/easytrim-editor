import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createAppStore } from "@/app/store/store";
// This provider integration test builds isolated runtime contracts to delay and settle seeks.
// eslint-disable-next-line no-restricted-imports
import {
  AudioPlaybackContext,
  type AudioPlaybackContract,
} from "@/features/audio/contexts/audio-playback-context";
// eslint-disable-next-line no-restricted-imports
import {
  AudioTransportContext,
  type AudioTransportContract,
} from "@/features/audio/contexts/audio-transport-context";
// eslint-disable-next-line no-restricted-imports
import {
  PreviewRuntimeContext,
  type PreviewRuntimeContract,
} from "@/features/preview/contexts/preview-runtime-context";
import { TimelinePlaybackProvider, useTimelineTransport } from "@/features/timeline";
import { firstSource, media } from "@/test/source.fixtures";

function CropInteractionPlaybackProbe() {
  const transport = useTimelineTransport();
  const resumePlaybackRef = useRef(false);

  return (
    <>
      <button onClick={() => transport.toggle()}>Play</button>
      <button
        onClick={() => {
          resumePlaybackRef.current = transport.suspendForInteraction();
        }}
      >
        Open crop
      </button>
      <button onClick={() => transport.resumeAfterInteraction(resumePlaybackRef.current)}>
        Close crop
      </button>
      <button onClick={() => transport.startShuttle(-1)}>Reverse shuttle</button>
      <button onClick={() => transport.startShuttle(1)}>Forward shuttle</button>
      <button onClick={() => transport.stopShuttle()}>Stop shuttle</button>
    </>
  );
}

function renderPlaybackHarness() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));

  const seekSettledCallbacks: Array<() => void> = [];
  let paused = true;
  const playMedia = vi.fn(async () => {
    paused = false;
  });

  const startAt = vi.fn(async () => []);
  const preview = {
    isPreviewReady: true,
    isNativeLoopEnabled: false,
    getMediaState: () => ({ currentTimeSeconds: 0, paused, seeking: false }),
    isSeekPending: () => false,
    onEnded: vi.fn(),
    onLoadedMetadata: vi.fn(),
    onPause: vi.fn(),
    onPlay: vi.fn(),
    onPlaybackError: vi.fn(),
    onTimeUpdate: vi.fn(),
    onCanPlay: vi.fn(),
    onPreviewPlaybackError: vi.fn(),
    previewKey: "source-1",
    pauseMedia: vi.fn(() => {
      paused = true;
    }),
    playMedia,
    requestPlaybackFrame: () => null,
    registerMediaObserver: () => () => undefined,
    seekMedia: vi.fn((_seconds: number, _approximate: boolean, onSettled?: () => void) => {
      if (onSettled) seekSettledCallbacks.push(onSettled);
    }),
    setNativeLoopEnabled: vi.fn(),
    setPlaybackRate: vi.fn(),
    setVideoElement: vi.fn(),
    videoRef: { current: null },
  } satisfies PreviewRuntimeContract;

  const audioPlayback = {
    audioMeterRef: { current: null },
    audioPlayheadRef: { current: null },
    clearLiveAudioTrackGain: vi.fn(),
    setLiveAudioTrackGain: vi.fn(),
  } satisfies AudioPlaybackContract;

  const audioTransport = {
    isReady: true,
    pause: vi.fn(),
    resumeAt: async () => [undefined, []],
    resumeAudioContext: async () => undefined,
    setPlaybackRate: vi.fn(),
    startAt,
    syncTo: vi.fn(),
    usesExternalAudio: false,
  } satisfies AudioTransportContract;

  render(
    <Provider store={store}>
      <PreviewRuntimeContext.Provider value={preview}>
        <AudioPlaybackContext.Provider value={audioPlayback}>
          <AudioTransportContext.Provider value={audioTransport}>
            <TimelinePlaybackProvider>
              <CropInteractionPlaybackProbe />
            </TimelinePlaybackProvider>
          </AudioTransportContext.Provider>
        </AudioPlaybackContext.Provider>
      </PreviewRuntimeContext.Provider>
    </Provider>,
  );

  return { playMedia, preview, seekSettledCallbacks, startAt };
}

describe("TimelinePlaybackProvider interaction lifecycle", () => {
  it("cancels pending playback startup and resumes it after the crop interaction", async () => {
    const { playMedia, preview, seekSettledCallbacks, startAt } = renderPlaybackHarness();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(seekSettledCallbacks).toHaveLength(1));

    preview.pauseMedia.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Open crop" }));
    expect(preview.pauseMedia).toHaveBeenCalledOnce();

    act(() => seekSettledCallbacks[0]?.());
    expect(playMedia).not.toHaveBeenCalled();
    expect(startAt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close crop" }));
    await waitFor(() => expect(seekSettledCallbacks).toHaveLength(2));
    act(() => seekSettledCallbacks[1]?.());

    await waitFor(() => expect(playMedia).toHaveBeenCalledOnce());
    expect(startAt).toHaveBeenCalledOnce();
  });

  it("cancels pending normal playback before starting reverse shuttle", async () => {
    const { playMedia, seekSettledCallbacks, startAt } = renderPlaybackHarness();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(seekSettledCallbacks).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Reverse shuttle" }));
    act(() => seekSettledCallbacks[0]?.());

    expect(playMedia).not.toHaveBeenCalled();
    expect(startAt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop shuttle" }));
  });

  it("clears a pending forward shuttle start so the next Play starts normally", async () => {
    const { playMedia, seekSettledCallbacks, startAt } = renderPlaybackHarness();

    fireEvent.click(screen.getByRole("button", { name: "Forward shuttle" }));
    await waitFor(() => expect(seekSettledCallbacks).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Stop shuttle" }));
    act(() => seekSettledCallbacks.splice(0).forEach((settle) => settle()));
    expect(playMedia).not.toHaveBeenCalled();
    expect(startAt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(seekSettledCallbacks).toHaveLength(1));
    act(() => seekSettledCallbacks[0]?.());

    await waitFor(() => expect(playMedia).toHaveBeenCalledOnce());
    expect(startAt).toHaveBeenCalledOnce();
  });
});
