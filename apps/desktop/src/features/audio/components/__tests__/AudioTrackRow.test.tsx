import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackGainChanged,
  audioTrackToggled,
  waveformReady,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { useTheme } from "@/app/theme/useTheme";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import {
  type AudioPlaybackAdapter,
  AudioTransportContext,
} from "../../contexts/audio-transport-context";
import { AudioTrackRow } from "../AudioTrack/AudioTrackRow";
import { AudioTrackGainControl } from "../AudioTrack/components/AudioTrackGainControl";

const { prepareSourceWaveforms } = vi.hoisted(() => ({ prepareSourceWaveforms: vi.fn() }));

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>()),
  prepareSourceWaveforms: (...args: unknown[]) => {
    prepareSourceWaveforms(...args);
    return () => undefined;
  },
}));

afterEach(() => {
  prepareSourceWaveforms.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createAudioPlayback() {
  return {
    getCurrentTimeSeconds: () => null,
    getMeter: () => null,
    hasActiveOutput: true,
    isReady: true,
    pause: () => undefined,
    prefetchAt: () => undefined,
    prepareAt: async () => undefined,
    registerPlaybackErrorObserver: () => () => undefined,
    seek: () => undefined,
    setLiveTrackGain: vi.fn(),
    startAlignedWithVideoAt: async (seconds: number) => seconds,
  } satisfies AudioPlaybackAdapter;
}

function createStore() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  return store;
}

function renderRow({ showColorPreview = false } = {}) {
  const store = createStore();
  const audioPlayback = createAudioPlayback();

  render(
    <Provider store={store}>
      <ThemeProvider>
        <AudioTransportContext.Provider value={audioPlayback}>
          <TooltipProvider>
            {showColorPreview && <PrimaryColorPreviewButton />}
            <AudioTrackRow streamIndex={2} />
          </TooltipProvider>
        </AudioTransportContext.Provider>
      </ThemeProvider>
    </Provider>,
  );

  return { audioPlayback, store };
}

function renderGainControl({ enabled = true } = {}) {
  const store = createStore();
  if (!enabled) {
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -6 }));
  }

  const audioPlayback = createAudioPlayback();
  const gainCommits: number[] = [];
  const dispatch = store.dispatch;
  store.dispatch = ((action: Parameters<typeof dispatch>[0]) => {
    if (audioTrackGainChanged.match(action)) gainCommits.push(action.payload.gainDb);
    return dispatch(action);
  }) as typeof store.dispatch;

  render(
    <Provider store={store}>
      <AudioTransportContext.Provider value={audioPlayback}>
        <TooltipProvider>
          <AudioTrackGainControl
            onLiveGainChange={() => undefined}
            streamIndex={2}
            trackNumber={1}
          />
        </TooltipProvider>
      </AudioTransportContext.Provider>
    </Provider>,
  );

  return { gainCommits, setLiveTrackGain: audioPlayback.setLiveTrackGain, store };
}

function PrimaryColorPreviewButton() {
  const { previewPrimaryColor } = useTheme();

  return (
    <button onClick={() => previewPrimaryColor("#123456")} type="button">
      Preview primary color
    </button>
  );
}

/** An envelope of `width` bins, each holding the left and right peak and RMS as `value`. */
function waveformEnvelope(width: number, value: number) {
  const buffer = new ArrayBuffer(12 + width * 4);
  const view = new DataView(buffer);
  view.setUint8(0, 0x45);
  view.setUint8(1, 0x54);
  view.setUint8(2, 0x57);
  view.setUint8(3, 0x46);
  view.setUint16(4, 2, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, width, true);
  for (let offset = 12; offset < buffer.byteLength; offset += 1) view.setUint8(offset, value);
  return buffer;
}

function mockCanvas({ height = 50, width = 32 } = {}) {
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const strokeStyle = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo,
    moveTo,
    set lineWidth(_value: number) {},
    set strokeStyle(value: string) {
      strokeStyle(value);
    },
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    height,
    width,
  } as DOMRect);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const getMaxHeight = () =>
    Math.max(
      0,
      ...lineTo.mock.calls.map((call, index) => {
        const top = moveTo.mock.calls[index]?.[1] as number;
        return (call[1] as number) - top;
      }),
    );

  return { getMaxHeight, lineTo, strokeStyle };
}

function showWaveform(store: ReturnType<typeof createAppStore>, width = 2) {
  act(() => {
    store.dispatch(waveformsLoading({ jobId: "waveform-1", streamIndexes: [2], width }));
    store.dispatch(
      waveformReady({
        jobId: "waveform-1",
        status: "ready",
        streamIndex: 2,
        url: "media://waveform",
        width,
      }),
    );
  });
}

describe("AudioTrackRow", () => {
  it("shows the waveform as preparing until it is ready", () => {
    renderRow();

    expect(screen.getByRole("status")).toHaveTextContent("Preparing waveform…");
  });

  it("draws the waveform in the live PrimaryColor preview", async () => {
    const { strokeStyle } = mockCanvas();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => waveformEnvelope(2, 128) }),
    );

    const { store } = renderRow({ showColorPreview: true });
    showWaveform(store);

    await waitFor(() => expect(strokeStyle).toHaveBeenCalledWith("rgb(239 191 4)"));
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("size-full", "opacity-80");

    fireEvent.click(screen.getByRole("button", { name: /preview primary color/i }));

    await waitFor(() => expect(strokeStyle).toHaveBeenCalledWith("rgb(18 52 86)"));
  });

  it("scales the waveform and its gain badge with the track gain", async () => {
    const { getMaxHeight, lineTo } = mockCanvas();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => waveformEnvelope(2, 64) }),
    );

    const { store } = renderRow();
    showWaveform(store);
    await waitFor(() => expect(lineTo).toHaveBeenCalled());
    const initialHeight = getMaxHeight();

    expect(screen.getByLabelText("Audio 1 gain in decibels")).toHaveTextContent("0.0 dB");

    act(() => store.dispatch(audioTrackGainChanged({ gainDb: 6, streamIndex: 2 })));

    expect(screen.getByLabelText("Audio 1 gain in decibels")).toHaveTextContent("6.0 dB");
    await waitFor(() => expect(getMaxHeight()).toBeGreaterThan(initialHeight));

    const drawnLineCount = lineTo.mock.calls.length;
    act(() => store.dispatch(audioTrackToggled({ streamIndex: 2 })));
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas?.parentElement).toHaveAttribute("data-enabled", "false");
    expect(lineTo).toHaveBeenCalledTimes(drawnLineCount);
  });

  it("switches the waveform display between peak, RMS, and stereo", async () => {
    const user = userEvent.setup();
    renderRow();

    const select = screen.getByRole("combobox", { name: "Waveform display" });
    expect(select).toHaveTextContent("Peak");

    await user.click(select);
    await user.click(await screen.findByRole("option", { name: /rms/i }));
    expect(select).toHaveTextContent("RMS");

    await user.click(select);
    await user.click(await screen.findByRole("option", { name: /stereo/i }));
    expect(select).toHaveTextContent("Stereo");
  });

  it("reports an undisplayable waveform and retries it", async () => {
    const user = userEvent.setup();
    mockCanvas();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const { store } = renderRow();
    showWaveform(store, 4096);

    expect(await screen.findByText("Waveform unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(prepareSourceWaveforms).toHaveBeenCalledWith(firstSource.sourcePath, [2], 4096);
  });

  it("double-click resets an adjusted gain with one final commit", () => {
    const { gainCommits, store } = renderGainControl();
    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });

    fireEvent.keyDown(gainSlider, { key: "ArrowLeft" });
    fireEvent.keyUp(gainSlider, { key: "ArrowLeft" });
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(-0.5);

    fireEvent.doubleClick(gainSlider);

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: 0 },
    });
    expect(gainCommits).toEqual([-0.5, 0]);
  });

  it("double-click resets Gain on a muted track without unmuting it", () => {
    const { gainCommits, store } = renderGainControl({ enabled: false });
    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });

    fireEvent.doubleClick(gainSlider);

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { gainDb: 0 },
    });
    expect(gainCommits).toEqual([0]);

    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "ArrowLeft" });
    fireEvent.keyUp(gainSlider, { key: "ArrowLeft" });

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { gainDb: -0.5 },
    });
    expect(gainCommits).toEqual([0, -0.5]);
  });

  it("cancels manual Gain edits on Escape and restores the committed playback gain", async () => {
    const user = userEvent.setup();
    const { gainCommits, setLiveTrackGain, store } = renderGainControl();

    await user.click(screen.getByRole("button", { name: /0 dB/i }));
    const gainInput = screen.getByRole("spinbutton", { name: /audio 1 gain/i });
    await user.clear(gainInput);
    await user.type(gainInput, "-10");
    expect(setLiveTrackGain).toHaveBeenLastCalledWith(2, -10);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("spinbutton", { name: /audio 1 gain/i })).not.toBeInTheDocument();
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(0);
    expect(gainCommits).toEqual([]);
    expect(setLiveTrackGain).toHaveBeenLastCalledWith(2, null);
  });

  it("clamps live Gain previews and commits while keeping the typed value visible", async () => {
    const user = userEvent.setup();
    const { gainCommits, setLiveTrackGain, store } = renderGainControl();

    await user.click(screen.getByRole("button", { name: /0 dB/i }));
    const gainInput = screen.getByRole("spinbutton", { name: /audio 1 gain/i });
    await user.clear(gainInput);
    await user.type(gainInput, "100");

    expect(gainInput).toHaveValue("100");
    expect(setLiveTrackGain).toHaveBeenLastCalledWith(2, 24);
    expect(gainInput).toHaveAttribute("aria-valuemin", "-60");
    expect(gainInput).toHaveAttribute("aria-valuemax", "24");
    expect(gainInput).toHaveAttribute("aria-valuenow", "24");
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(0);

    fireEvent.blur(gainInput);

    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(24);
    expect(gainCommits).toEqual([24]);

    await user.click(screen.getByRole("button", { name: /24\.0 dB/i }));
    const lowerGainInput = screen.getByRole("spinbutton", { name: /audio 1 gain/i });
    await user.clear(lowerGainInput);
    expect(lowerGainInput).toHaveValue("");
    expect(setLiveTrackGain).toHaveBeenLastCalledWith(2, 24);

    await user.type(lowerGainInput, "-");
    expect(lowerGainInput).toHaveValue("-");
    expect(setLiveTrackGain).toHaveBeenLastCalledWith(2, 24);
    await user.clear(lowerGainInput);
    await user.paste("-100");
    expect(lowerGainInput).toHaveValue("-100");
    expect(setLiveTrackGain).toHaveBeenLastCalledWith(2, -60);
    fireEvent.blur(lowerGainInput);

    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(-60);
    expect(gainCommits).toEqual([24, -60]);
  });

  it("marks the Gain range on hover, resets to unity, and preserves mute state", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.hover(screen.getByRole("button", { name: /mute.*eng/i }));

    const gainSlider = await screen.findByRole("slider", { name: /audio 1 gain/i });
    expect(screen.getByText("-24", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("12", { exact: true })).toBeInTheDocument();
    expect(gainSlider).toHaveAttribute("aria-valuemin", "-24");
    expect(gainSlider).toHaveAttribute("aria-valuemax", "12");

    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "Home" });
    fireEvent.keyUp(gainSlider, { key: "Home" });
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(-24);
    expect(screen.getAllByText("−24.0 dB")).toHaveLength(2);

    fireEvent.doubleClick(gainSlider);
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: 0 },
    });

    await user.click(screen.getByRole("button", { name: /mute.*eng/i }));
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { gainDb: 0 },
    });
  });

  it("previews gain adjustments in playback and on the waveform", async () => {
    const { getMaxHeight, lineTo } = mockCanvas();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => waveformEnvelope(2, 64) }),
    );

    const { audioPlayback, store } = renderRow();
    showWaveform(store);
    await waitFor(() => expect(lineTo).toHaveBeenCalled());
    const initialHeight = getMaxHeight();

    await userEvent.setup().hover(screen.getByRole("button", { name: /mute.*eng/i }));
    const gainSlider = await screen.findByRole("slider", { name: /audio 1 gain/i });
    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "End" });

    expect(audioPlayback.setLiveTrackGain).toHaveBeenLastCalledWith(2, 12);
    expect(document.querySelector('[data-slot="audio-track-gain-indicator"]')).toHaveTextContent(
      "12.0 dB",
    );
    await waitFor(() => expect(getMaxHeight()).toBeGreaterThan(initialHeight));

    fireEvent.keyUp(gainSlider, { key: "End" });
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(12);
  });
});
