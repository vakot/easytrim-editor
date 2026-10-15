import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackGainChanged,
  audioTrackMetadataChanged,
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
import { audioTrackColor } from "../../lib/audio-track-color";
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
    setLiveOutputVolume: () => undefined,
    setLiveTrackGain: vi.fn(),
    setPlaybackRate: () => undefined,
    startAlignedWithVideoAt: async (seconds: number) => seconds,
  } satisfies AudioPlaybackAdapter;
}

function createStore(sourceLanguage: string | undefined = "eng") {
  const store = createAppStore();
  const media = mediaWithAudio(firstSource.sourcePath);
  media.audioStreams[0]!.language = sourceLanguage;
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media }));
  return store;
}

function renderRow({
  enabled = true,
  showColorPreview = false,
  sourceLanguage,
  streamIndex = 2,
}: {
  enabled?: boolean;
  showColorPreview?: boolean;
  sourceLanguage?: string;
  streamIndex?: number;
} = {}) {
  const store = createStore(sourceLanguage);
  if (!enabled) store.dispatch(audioTrackToggled({ streamIndex }));
  const audioPlayback = createAudioPlayback();

  render(
    <Provider store={store}>
      <ThemeProvider>
        <AudioTransportContext.Provider value={audioPlayback}>
          <TooltipProvider>
            {showColorPreview && <PrimaryColorPreviewButton />}
            <AudioTrackRow streamIndex={streamIndex} />
          </TooltipProvider>
        </AudioTransportContext.Provider>
      </ThemeProvider>
    </Provider>,
  );

  return { audioPlayback, store };
}

function detectActivityRanges(store: ReturnType<typeof createStore>) {
  act(() => {
    store.dispatch(
      audioTrackActivityAnalysisStarted({ operationId: "activity-2", streamIndex: 2 }),
    );
    store.dispatch(
      audioTrackActivityAnalysisReady({
        operationId: "activity-2",
        result: [{ endMicros: 2_000_000, startMicros: 1_000_000 }],
        streamIndex: 2,
      }),
    );
  });
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

  it("overlays the timeline selection on the waveform from the shared axis", () => {
    renderRow();

    const selection = document.querySelector('[data-slot="audio-track-selection"]');
    expect(selection).toHaveAttribute("aria-hidden", "true");
    expect(selection).toHaveClass(
      "pointer-events-none",
      "left-(--timeline-selection-start)",
      "right-(--timeline-selection-end-inset)",
    );
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

  it("offers Enable, Default, and metadata editing in the actions menu", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByRole("menuitemcheckbox", { name: "Enable" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Default" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /edit output metadata/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /effects/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /analyze audio activity/i }),
    ).not.toBeChecked();

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Enable" }));

    expect(store.getState().audio.tracks[0]?.enabled).toBe(false);
    expect(screen.getByRole("menuitemcheckbox", { name: "Enable" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("switches the waveform display from the actions and context menus", async () => {
    const user = userEvent.setup();
    renderRow();
    const select = screen.getByRole("combobox", { name: "Waveform display" });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    expect(screen.getByRole("menuitemradio", { name: "Peak" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("menuitemradio", { name: "RMS" }));

    expect(screen.getByRole("menuitemradio", { name: "RMS" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(select).toHaveTextContent("RMS");
    await user.keyboard("{Escape}");

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });
    expect(screen.getByRole("menuitemradio", { name: "RMS" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Stereo" }));

    expect(select).toHaveTextContent("Stereo");
  });

  it("makes an enabled track the default from its actions menu", async () => {
    const user = userEvent.setup();
    const { store } = renderRow({ streamIndex: 4 });

    await user.click(screen.getByRole("button", { name: /audio 2 actions/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Default" }));

    expect(store.getState().audio.tracks.map((track) => track.metadata.isDefault)).toEqual([
      false,
      true,
    ]);
    expect(screen.getByText("#2 · AC3 · 5.1 · Default")).toBeInTheDocument();
  });

  it("explains why the default track action is disabled", async () => {
    const user = userEvent.setup();
    renderRow({ enabled: false });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    const defaultAction = screen.getByRole("menuitemcheckbox", { name: "Default" });
    expect(defaultAction).toHaveAttribute("aria-disabled", "true");

    const tooltipTrigger = defaultAction.parentElement;
    expect(tooltipTrigger).toHaveAttribute("data-slot", "tooltip-trigger");
    await user.hover(tooltipTrigger!);

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent("Enable this track first");
      expect(tooltip).toHaveAttribute("data-side", "right");
    });
  });

  it("exposes the same commands in the row context menu", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });

    expect(screen.getByRole("menuitemcheckbox", { name: "Enable" })).toBeInTheDocument();
    const defaultAction = screen.getByRole("menuitemcheckbox", { name: "Default" });
    expect(defaultAction).not.toHaveAttribute("aria-disabled", "true");
    expect(defaultAction.parentElement).not.toHaveAttribute("data-slot", "tooltip-trigger");
    expect(screen.queryByRole("menuitem", { name: /effects/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));

    expect(await screen.findByRole("dialog", { name: "Output audio metadata" })).toBeVisible();
    expect(await screen.findByRole("textbox", { name: "Track title" })).toHaveFocus();
  });

  it("uses the source title as the placeholder and inherits it when submitted empty", async () => {
    const user = userEvent.setup();
    const { store } = renderRow({ streamIndex: 4 });
    expect(screen.getByText("Surround")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /audio 2 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "Surround");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByText("Surround")).toBeInTheDocument();
    expect(
      store.getState().audio.tracks.find((track) => track.streamIndex === 4)?.metadata.title,
    ).toBeUndefined();
  });

  it("names the track after a saved title and restores its source fallback when cleared", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.type(
      await screen.findByRole("textbox", { name: "Track title" }),
      "Custom track title",
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mute.*custom track title/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveValue("Custom track title");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByRole("button", { name: "Mute (eng)" })).toBeInTheDocument();
  });

  it("closes the metadata dialog without saving from its footer Close button", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.type(await screen.findByRole("textbox", { name: "Track title" }), "Unsaved title");
    await user.click(
      within(document.querySelector('[data-slot="dialog-footer"]')!).getByRole("button", {
        name: "Close",
      }),
    );

    expect(screen.queryByRole("textbox", { name: "Track title" })).not.toBeInTheDocument();
    expect(store.getState().audio.tracks[0]?.metadata.title).toBeUndefined();
  });

  it("preserves an untouched title while editing language and allows an explicit title reset", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    act(() => {
      store.dispatch(
        audioTrackMetadataChanged({ streamIndex: 2, title: "Custom title", language: "rus" }),
      );
    });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await screen.findByRole("textbox", { name: "Track title" });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata).toEqual({
      isDefault: true,
      title: "Custom title",
      language: "rus",
    });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(await screen.findByRole("button", { name: /use source language/i }));
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("English");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata).toMatchObject({
      title: "Custom title",
      language: undefined,
    });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    await user.type(titleInput, "Temporary title");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.title).toBeUndefined();
  });

  it("selects and resets a language override using source metadata codes", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const selector = await screen.findByRole("button", { name: "Language" });
    expect(selector).toHaveTextContent("English");
    await user.click(selector);
    await user.click(screen.getByRole("option", { name: "Русский (Russian), ru" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBe("rus");

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(await screen.findByRole("button", { name: /use source language/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(await screen.findByRole("button", { name: "Language" }));
    await user.type(screen.getByRole("combobox", { name: /search languages/i }), "French");
    await user.click(screen.getByRole("option", { name: "Français (French), fr" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBe("fra");
  });

  it("clears a language override when the source language is unsupported", async () => {
    const user = userEvent.setup();
    const { store } = renderRow({ sourceLanguage: "qaa" });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const selector = await screen.findByRole("button", { name: "Language" });
    expect(selector).toHaveTextContent("Select a language");
    expect(selector).not.toHaveTextContent("qaa");

    await user.click(selector);
    await user.click(screen.getByRole("option", { name: "Čeština (Czech), cs" }));
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("Čeština");

    await user.click(screen.getByRole("button", { name: /use source language/i }));
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("Select a language");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBeUndefined();
  });

  it("draws detected activity ranges on the waveform in the track color", () => {
    const { store } = renderRow();
    detectActivityRanges(store);

    const range = document.querySelector('[data-slot="audio-track-activity-range"]');
    expect(range).toHaveStyle({
      backgroundColor: audioTrackColor(2),
      left: "20%",
      right: "60%",
    });
  });

  it("hides detected activity ranges from the actions menu", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    detectActivityRanges(store);

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    const showRanges = screen.getByRole("menuitemcheckbox", { name: /show detected ranges/i });
    expect(showRanges).toBeChecked();

    await user.click(showRanges);

    expect(store.getState().audio.tracks[0]?.activityVisible).toBe(false);
    await waitFor(() =>
      expect(document.querySelector('[data-slot="audio-track-activity-range"]')).toBeNull(),
    );
  });

  it("allows a muted track to run activity analysis", async () => {
    const user = userEvent.setup();
    renderRow({ enabled: false });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByRole("menuitemcheckbox", { name: /analyze audio activity/i })).toBeEnabled();
  });
});
