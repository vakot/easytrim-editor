import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioChainSelection, AudioFilter } from "@/domain/audio-processing";
import { createFakeAudioContext } from "@/test/audio-context.fixtures";

interface DecodeCall {
  normalized: boolean;
  replacement: boolean;
  signal: AbortSignal;
  startMicros: number;
}

interface NativeRequest {
  key: string;
  reject: (error: unknown) => void;
  stream: number;
}

const mocks = vi.hoisted(() => ({
  analyses: [] as Array<{ resolve: (value: unknown) => void; signal: AbortSignal | undefined }>,
  decodes: [] as DecodeCall[],
  /** The native render ownership of each stream: its audible and replacement processing. */
  native: {
    audible: new Map<number, string>(),
    inFlight: new Set<NativeRequest>(),
    replacement: new Map<number, string>(),
    superseded: 0,
  },
  replacementGate: { open: false, waiting: [] as Array<() => void> },
}));

const normalizedMarker = 0.75;
const unprocessedMarker = 0.25;
/** Long enough that audible requests are still rendering when other requests arrive. */
const AUDIBLE_RENDER_MS = 300;

/** Mirrors `ScopeState::begin`: a request of another key supersedes the revision of its kind. */
function beginNativeRequest(stream: number, key: string, replacement: boolean) {
  const { native } = mocks;
  const audible = native.audible.get(stream);
  const pending = native.replacement.get(stream);
  if (key === audible || key === pending) {
    if (!replacement && key === pending) {
      native.audible.set(stream, key);
      native.replacement.delete(stream);
    }
  } else if (replacement) {
    native.replacement.set(stream, key);
  } else {
    native.audible.set(stream, key);
    native.replacement.delete(stream);
  }
  for (const request of native.inFlight) {
    const live = [native.audible.get(request.stream), native.replacement.get(request.stream)];
    if (live.includes(request.key)) continue;
    native.inFlight.delete(request);
    native.superseded += 1;
    request.reject({
      code: "cancelled",
      messageId: "media.audio.processingChangedBeforeAudioWasReady",
    });
  }
}

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  analyzeAudioLoudness: vi.fn(
    (_request: unknown, signal?: AbortSignal) =>
      new Promise((resolve) => mocks.analyses.push({ resolve, signal })),
  ),
  cancelOperation: vi.fn(async () => undefined),
  decodeAudioPlaybackChunk: vi.fn(
    async (
      _sourcePath: string,
      selection: AudioChainSelection,
      startMicros: number,
      durationMicros: number,
      signal: AbortSignal,
      role: { replacement?: boolean } = {},
    ) => {
      const normalized = selection.filters.some(({ type }) => type === "loudnessNormalization");
      const replacement = role.replacement ?? false;
      const key = JSON.stringify([selection.filters, selection.loudnessMeasurements ?? []]);
      mocks.decodes.push({ normalized, replacement, signal, startMicros });
      beginNativeRequest(selection.streamIndex, key, replacement);
      await new Promise<void>((resolve, reject) => {
        const request = { key, reject, stream: selection.streamIndex };
        mocks.native.inFlight.add(request);
        // A request the caller abandoned is cancelled, not superseded.
        signal.addEventListener("abort", () => {
          if (mocks.native.inFlight.delete(request)) {
            reject(new DOMException("The decode was cancelled.", "AbortError"));
          }
        });
        const finish = () => {
          if (!mocks.native.inFlight.delete(request)) return;
          resolve();
        };

        // The replacement is slower than everything playback has buffered.
        if (replacement && !mocks.replacementGate.open) mocks.replacementGate.waiting.push(finish);
        else setTimeout(finish, AUDIBLE_RENDER_MS);
      });
      const frames = Math.round((durationMicros * 48_000) / 1_000_000);
      return {
        channels: 2,
        sampleRate: 48_000,
        samples: new Float32Array(frames * 2).fill(
          normalized ? normalizedMarker : unprocessedMarker,
        ),
      };
    },
  ),
  releaseAudioPlaybackPreview: vi.fn(async () => undefined),
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioFilterPreviewChanged,
  audioFilterPreviewStarted,
  selectAudioFilterPreviewStatus,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { useAudioPlaybackRuntime } from "../useAudioPlaybackRuntime";

const normalization: AudioFilter = {
  enabled: true,
  id: "norm",
  loudnessRangeLu: 11,
  maxTruePeakDb: -1.5,
  targetLufs: -16,
  type: "loudnessNormalization",
};

function markerOf(source: { buffer: AudioBuffer | null }) {
  return (source.buffer as unknown as { channels: Float32Array[] }).channels[0]!.at(-1)!;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.analyses.length = 0;
  mocks.decodes.length = 0;
  mocks.replacementGate.open = false;
  mocks.replacementGate.waiting.length = 0;
  mocks.native.audible.clear();
  mocks.native.replacement.clear();
  mocks.native.inFlight.clear();
  mocks.native.superseded = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("live filter preview during playback", () => {
  it("keeps the audible chain playing while normalization is measured and rendered", async () => {
    const audio = createFakeAudioContext();
    vi.stubGlobal("AudioContext", function FakeAudioContext() {
      return audio.context;
    } as unknown as typeof AudioContext);
    const store = createAppStore();
    const media = { ...mediaWithAudio(firstSource.sourcePath), durationMicros: 60_000_000 };
    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useAudioPlaybackRuntime(), { wrapper });
    const playbackError = vi.fn();
    result.current.registerPlaybackErrorObserver(playbackError);

    await act(async () => {
      const preparing = result.current.prepareAt(0);
      await vi.advanceTimersByTimeAsync(AUDIBLE_RENDER_MS);
      await preparing;
      await result.current.startAlignedWithVideoAt(0);
    });
    // A looping run prefetches its restart point, and again whenever its options change.
    const prefetchLoopStart = () => act(() => result.current.prefetchAt(0));
    prefetchLoopStart();
    const contextStart = audio.sources[0]!.start.mock.calls[0]![0] as number;
    const startsAndMarkers = () =>
      audio.sources
        .filter((source) => source.buffer)
        .map((source) => ({
          marker: markerOf(source),
          start: source.start.mock.calls[0]![0] as number,
        }));

    /** Advances the context clock in steps so the pump runs as it would in real time. */
    async function play(seconds: number) {
      for (let step = 0; step < seconds * 4; step += 1) {
        audio.setCurrentTime(audio.context.currentTime + 0.25);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(250);
        });
      }
    }

    // Both tracks play; preview stream 2 with a draft that adds loudness normalization.
    await play(1);
    act(() => {
      store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
      store.dispatch(audioFilterPreviewChanged({ filters: [normalization], id: "preview" }));
    });
    await play(0.5);
    expect(mocks.analyses).toHaveLength(1);
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("analyzing");

    // The measurement takes longer than all the audio buffered when it started.
    const bufferedWhenMeasuringStarted = Math.max(...startsAndMarkers().map(({ start }) => start));
    await play(4);
    prefetchLoopStart();
    await play(4);
    expect(playbackError).not.toHaveBeenCalled();
    expect(Math.max(...startsAndMarkers().map(({ start }) => start))).toBeGreaterThan(
      bufferedWhenMeasuringStarted + 6,
    );
    expect(startsAndMarkers().every(({ marker }) => marker === unprocessedMarker)).toBe(true);

    act(() => mocks.analyses[0]!.resolve([{ filterId: "norm", integratedLufs: -20 }]));
    await play(0.5);
    expect(mocks.decodes.some(({ normalized, replacement }) => normalized && replacement)).toBe(
      true,
    );

    // The replacement render is slower than the buffered audio too.
    const audibleRequestsBefore = mocks.decodes.filter(({ replacement }) => !replacement).length;
    await play(4);
    prefetchLoopStart();
    await play(4);
    expect(playbackError).not.toHaveBeenCalled();
    expect(mocks.native.superseded).toBe(0);
    expect(mocks.decodes.filter(({ replacement }) => !replacement).length).toBeGreaterThan(
      audibleRequestsBefore + 6,
    );
    // Nothing requests the replacement as audible processing before playback switches to it.
    expect(
      mocks.decodes.filter(({ normalized, replacement }) => normalized && !replacement),
    ).toEqual([]);
    expect(startsAndMarkers().every(({ marker }) => marker === unprocessedMarker)).toBe(true);
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("updating");

    // Scheduled audio stayed contiguous: after the first, partly played chunk, one every 2 s.
    const starts = startsAndMarkers()
      .map(({ start }) => start)
      .filter((start, index, all) => all.indexOf(start) === index);

    expect(starts[0]).toBe(contextStart);
    expect(starts.slice(1)).toEqual(starts.slice(1).map((_, index) => 7 + index * 2));

    mocks.replacementGate.open = true;
    for (const release of mocks.replacementGate.waiting.splice(0)) release();
    await play(3);
    expect(playbackError).not.toHaveBeenCalled();
    expect(mocks.native.superseded).toBe(0);
    expect(startsAndMarkers().some(({ marker }) => marker === normalizedMarker)).toBe(true);
    expect(selectAudioFilterPreviewStatus(store.getState())).toBe("active");
  });
});
