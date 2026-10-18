import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackFiltersApplied,
  audioTrackMetadataChanged,
  audioTrackSyncOffsetChanged,
  audioTrackToggled,
  audioTrackVolumeChanged,
  waveformReady,
  waveformsFailed,
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
import { AudioTrackVolumeControl } from "../AudioTrack/components/AudioTrackVolumeControl";

const { prepareSourceWaveforms, timeline } = vi.hoisted(() => ({
  prepareSourceWaveforms: vi.fn(),
  timeline: { positionMicros: 0 },
}));

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>()),
  prepareSourceWaveforms: (...args: unknown[]) => {
    prepareSourceWaveforms(...args);
    return () => undefined;
  },
}));

vi.mock("@/features/playback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/playback")>()),
  useTimelinePlayback: () => ({
    durationMicros: 0,
    framesCount: 0,
    getPositionMicros: () => timeline.positionMicros,
    seekTime: () => undefined,
    stepFrame: () => false,
  }),
}));

afterEach(() => {
  prepareSourceWaveforms.mockReset();
  timeline.positionMicros = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createAudioPlayback() {
  return {
    getCurrentTimeSeconds: () => null,
    getMeter: () => null,
    hasActiveOutput: true,
    mutesPreviewVideo: true,
    isReady: true,
    pause: () => undefined,
    prefetchAt: () => undefined,
    prepareAt: async () => undefined,
    registerPlaybackErrorObserver: () => () => undefined,
    seek: () => undefined,
    setLiveOutputVolume: () => undefined,
    setLiveTrackVolume: vi.fn(),
    setPlaybackRate: () => undefined,
    startAlignedWithVideoAt: async (seconds: number) => seconds,
  } satisfies AudioPlaybackAdapter;
}

function createStore(
  sourceLanguage: string | undefined = "eng",
  {
    audioDurationMicros,
    audioStartTimeMicros,
    mediaDurationMicros,
  }: {
    audioDurationMicros?: number;
    audioStartTimeMicros?: number;
    mediaDurationMicros?: number;
  } = {},
) {
  const store = createAppStore();
  const media = mediaWithAudio(firstSource.sourcePath);
  if (mediaDurationMicros !== undefined) media.durationMicros = mediaDurationMicros;
  if (audioDurationMicros !== undefined) {
    media.audioStreams[0]!.durationMicros = audioDurationMicros;
  }
  if (audioStartTimeMicros !== undefined) {
    media.audioStreams[0]!.startTimeMicros = audioStartTimeMicros;
  }
  media.audioStreams[0]!.language = sourceLanguage;
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media }));
  return store;
}

function renderRow({
  audioDurationMicros,
  audioStartTimeMicros,
  enabled = true,
  mediaDurationMicros,
  showColorPreview = false,
  sourceLanguage,
  streamIndex = 2,
}: {
  audioDurationMicros?: number;
  audioStartTimeMicros?: number;
  enabled?: boolean;
  mediaDurationMicros?: number;
  showColorPreview?: boolean;
  sourceLanguage?: string;
  streamIndex?: number;
} = {}) {
  const store = createStore(sourceLanguage, {
    audioDurationMicros,
    audioStartTimeMicros,
    mediaDurationMicros,
  });

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

function renderVolumeControl({ enabled = true, volume = 1 } = {}) {
  const store = createStore();
  if (!enabled) store.dispatch(audioTrackToggled({ streamIndex: 2 }));
  if (volume !== 1) store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volume }));

  const audioPlayback = createAudioPlayback();
  const volumeCommits: number[] = [];
  const dispatch = store.dispatch;
  store.dispatch = ((action: Parameters<typeof dispatch>[0]) => {
    if (audioTrackVolumeChanged.match(action)) volumeCommits.push(action.payload.volume);
    return dispatch(action);
  }) as typeof store.dispatch;

  render(
    <Provider store={store}>
      <AudioTransportContext.Provider value={audioPlayback}>
        <TooltipProvider>
          <AudioTrackVolumeControl
            onLiveVolumeChange={() => undefined}
            streamIndex={2}
            trackNumber={1}
          />
        </TooltipProvider>
      </AudioTransportContext.Provider>
    </Provider>,
  );

  return { setLiveTrackVolume: audioPlayback.setLiveTrackVolume, store, volumeCommits };
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
// Moving a pointer toward a submenu item closes the submenu in jsdom, which has no layout for
// Radix's pointer grace area, so submenu items are activated from the keyboard.
async function selectWithKeyboard(user: ReturnType<typeof userEvent.setup>, item: HTMLElement) {
  item.focus();
  await user.keyboard("{Enter}");
}

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
    drawImage: vi.fn(),
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
  it("previews and confirms interactive synchronization without moving the video playhead", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    timeline.positionMicros = 1_000_000;
    const interaction = document.querySelector<HTMLElement>(
      '[data-slot="audio-sync-interaction"]',
    )!;

    vi.spyOn(interaction, "getBoundingClientRect").mockReturnValue({
      bottom: 50,
      height: 50,
      left: 100,
      right: 1_100,
      top: 0,
      width: 1_000,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(interaction, { clientX: 600, pointerType: "mouse" });
    expect(document.querySelector('[data-slot="audio-sync-ghost-playhead"]')).toHaveStyle({
      left: "50%",
    });
    fireEvent.click(interaction, { altKey: true, button: 0, clientX: 600 });

    const confirm = await screen.findByRole("button", { name: "Sync offset" });
    expect(document.querySelector('[data-slot="audio-sync-temporary-marker"]')).toHaveStyle({
      left: "50%",
    });
    expect(document.activeElement).toBe(confirm);
    expect(timeline.positionMicros).toBe(1_000_000);

    await user.keyboard("{Enter}");

    expect(store.getState().audio.tracks[0]?.processing.syncOffset).toEqual({
      enabled: true,
      // video reference (1 s) + existing offset (0) - clicked waveform time (2.5 s)
      offsetMicros: -1_500_000,
    });
    await waitFor(() =>
      expect(document.querySelector('[data-slot="audio-sync-temporary-marker"]')).toBeNull(),
    );
    expect(timeline.positionMicros).toBe(1_000_000);
  });

  it("uses media-derived bounds for interactive offsets beyond ten seconds", async () => {
    const user = userEvent.setup();
    const { store } = renderRow({
      audioDurationMicros: 100_000_000,
      audioStartTimeMicros: 5_000_000,
      mediaDurationMicros: 60_000_000,
    });

    timeline.positionMicros = 55_000_000;
    const interaction = document.querySelector<HTMLElement>(
      '[data-slot="audio-sync-interaction"]',
    )!;

    vi.spyOn(interaction, "getBoundingClientRect").mockReturnValue({
      bottom: 50,
      height: 50,
      left: 100,
      right: 1_100,
      top: 0,
      width: 1_000,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(interaction, { altKey: true, button: 0, clientX: 600 });
    await user.keyboard("{Enter}");

    expect(store.getState().audio.tracks[0]?.processing.syncOffset).toEqual({
      enabled: true,
      offsetMicros: 25_000_000,
    });
  });

  it("cancels interactive synchronization on Escape without changing an existing offset", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    store.dispatch(
      audioTrackSyncOffsetChanged({
        streamIndex: 2,
        syncOffset: { enabled: true, offsetMicros: 500_000 },
      }),
    );
    const interaction = document.querySelector<HTMLElement>(
      '[data-slot="audio-sync-interaction"]',
    )!;

    vi.spyOn(interaction, "getBoundingClientRect").mockReturnValue({
      bottom: 50,
      height: 50,
      left: 100,
      right: 1_100,
      top: 0,
      width: 1_000,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(interaction, { altKey: true, button: 0, clientX: 600 });
    await screen.findByRole("button", { name: "Sync offset" });

    await user.keyboard("{Escape}");

    expect(store.getState().audio.tracks[0]?.processing.syncOffset).toEqual({
      enabled: true,
      offsetMicros: 500_000,
    });
    await waitFor(() =>
      expect(document.querySelector('[data-slot="audio-sync-temporary-marker"]')).toBeNull(),
    );
  });

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

  it("marks audio shifted outside the video timeline as unavailable and blocks sync clicks there", () => {
    const { store } = renderRow();
    act(() => {
      store.dispatch(
        audioTrackSyncOffsetChanged({
          streamIndex: 2,
          syncOffset: { enabled: true, offsetMicros: 6_000_000 },
        }),
      );
    });

    const unavailable = document.querySelector<HTMLElement>(
      '[data-slot="audio-unavailable-region"]',
    );

    expect(unavailable).toHaveStyle({ left: "0%", right: "0%" });
    const interaction = document.querySelector<HTMLElement>(
      '[data-slot="audio-sync-interaction"]',
    )!;

    vi.spyOn(interaction, "getBoundingClientRect").mockReturnValue({
      bottom: 50,
      height: 50,
      left: 100,
      right: 1_100,
      top: 0,
      width: 1_000,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(interaction, { altKey: true, button: 0, clientX: 600 });

    expect(document.querySelector('[data-slot="audio-sync-temporary-marker"]')).toBeNull();
  });

  it("keeps ordinary waveform clicks available without opening sync confirmation", () => {
    const { store } = renderRow();
    const interaction = document.querySelector<HTMLElement>(
      '[data-slot="audio-sync-interaction"]',
    )!;

    vi.spyOn(interaction, "getBoundingClientRect").mockReturnValue({
      bottom: 50,
      height: 50,
      left: 100,
      right: 1_100,
      top: 0,
      width: 1_000,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(interaction, { clientX: 600, pointerType: "mouse" });
    expect(document.querySelector('[data-slot="audio-sync-ghost-playhead"]')).toHaveStyle({
      left: "50%",
    });

    fireEvent.click(interaction, { button: 0, clientX: 600 });

    expect(document.querySelector('[data-slot="audio-sync-temporary-marker"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Sync offset" })).not.toBeInTheDocument();
    expect(store.getState().audio.tracks[0]?.processing.syncOffset).toBeUndefined();
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

  it("scales the processed waveform display and volume badge with Track Volume", async () => {
    const { getMaxHeight, lineTo } = mockCanvas();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => waveformEnvelope(2, 64) }),
    );

    const { store } = renderRow();
    showWaveform(store);
    await waitFor(() => expect(lineTo).toHaveBeenCalled());
    const initialHeight = getMaxHeight();

    expect(screen.getByLabelText("Audio 1 volume")).toHaveTextContent("100%");

    act(() => store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volume: 2 })));

    expect(screen.getByLabelText("Audio 1 volume")).toHaveTextContent("200%");
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

  it("double-click resets an adjusted volume to 100% with one final commit", () => {
    const { store, volumeCommits } = renderVolumeControl();
    const volumeSlider = screen.getByRole("slider", { name: /audio 1 volume/i });

    fireEvent.keyDown(volumeSlider, { key: "ArrowLeft" });
    fireEvent.keyUp(volumeSlider, { key: "ArrowLeft" });
    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(0.99);

    fireEvent.doubleClick(volumeSlider);

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { filters: [], volume: 1 },
    });
    expect(volumeCommits).toEqual([0.99, 1]);
  });

  it("double-click resets volume on a muted track without unmuting it", () => {
    const { store, volumeCommits } = renderVolumeControl({ enabled: false, volume: 0.5 });
    const volumeSlider = screen.getByRole("slider", { name: /audio 1 volume/i });

    fireEvent.doubleClick(volumeSlider);

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { filters: [], volume: 1 },
    });
    expect(volumeCommits).toEqual([1]);

    volumeSlider.focus();
    fireEvent.keyDown(volumeSlider, { key: "ArrowLeft" });
    fireEvent.keyUp(volumeSlider, { key: "ArrowLeft" });

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { volume: 0.99 },
    });
    expect(volumeCommits).toEqual([1, 0.99]);
  });

  it("cancels manual volume edits on Escape and restores the committed playback volume", async () => {
    const user = userEvent.setup();
    const { setLiveTrackVolume, store, volumeCommits } = renderVolumeControl();

    await user.click(screen.getByRole("button", { name: "100%" }));
    const volumeInput = screen.getByRole("spinbutton", { name: /audio 1 volume/i });
    await user.clear(volumeInput);
    await user.type(volumeInput, "40");
    expect(setLiveTrackVolume).toHaveBeenLastCalledWith(2, 0.4);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("spinbutton", { name: /audio 1 volume/i })).not.toBeInTheDocument();
    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(1);
    expect(volumeCommits).toEqual([]);
    expect(setLiveTrackVolume).toHaveBeenLastCalledWith(2, null);
  });

  it("accepts manual volume up to 500% without the slider clamping it", async () => {
    const user = userEvent.setup();
    const { setLiveTrackVolume, store, volumeCommits } = renderVolumeControl();

    await user.click(screen.getByRole("button", { name: "100%" }));
    const volumeInput = screen.getByRole("spinbutton", { name: /audio 1 volume/i });
    expect(volumeInput).toHaveAttribute("aria-valuemin", "0");
    expect(volumeInput).toHaveAttribute("aria-valuemax", "500");
    await user.clear(volumeInput);
    await user.type(volumeInput, "350");
    expect(setLiveTrackVolume).toHaveBeenLastCalledWith(2, 3.5);
    fireEvent.blur(volumeInput);

    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(3.5);
    const volumeSlider = screen.getByRole("slider", { name: /audio 1 volume/i });
    // The slider tops out at 200% while the label and stored value keep 350%.
    expect(volumeSlider).toHaveAttribute("aria-valuenow", "200");
    expect(screen.getByRole("button", { name: "350%" })).toBeInTheDocument();

    fireEvent.pointerDown(volumeSlider);
    fireEvent.pointerUp(volumeSlider);
    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(3.5);

    await user.click(screen.getByRole("button", { name: "350%" }));
    const clampedInput = screen.getByRole("spinbutton", { name: /audio 1 volume/i });
    await user.clear(clampedInput);
    await user.type(clampedInput, "900");
    expect(clampedInput).toHaveValue("900");
    expect(setLiveTrackVolume).toHaveBeenLastCalledWith(2, 5);
    fireEvent.blur(clampedInput);

    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(5);
    expect(volumeCommits).toEqual([3.5, 5]);
  });

  it("resets the volume to 100% on hover and preserves mute state", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.hover(screen.getByRole("button", { name: /mute.*eng/i }));

    const volumeSlider = await screen.findByRole("slider", { name: /audio 1 volume/i });
    expect(volumeSlider).toHaveAttribute("aria-valuemin", "0");
    expect(volumeSlider).toHaveAttribute("aria-valuemax", "200");

    volumeSlider.focus();
    fireEvent.keyDown(volumeSlider, { key: "Home" });
    fireEvent.keyUp(volumeSlider, { key: "Home" });
    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(0);

    fireEvent.doubleClick(volumeSlider);
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { filters: [], volume: 1 },
    });

    await user.click(screen.getByRole("button", { name: /mute.*eng/i }));
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { filters: [], volume: 1 },
    });
  });

  it("previews volume adjustments in playback and the waveform display", async () => {
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
    const volumeSlider = await screen.findByRole("slider", { name: /audio 1 volume/i });
    volumeSlider.focus();
    fireEvent.keyDown(volumeSlider, { key: "End" });

    expect(audioPlayback.setLiveTrackVolume).toHaveBeenLastCalledWith(2, 2);
    expect(document.querySelector('[data-slot="audio-track-volume-indicator"]')).toHaveTextContent(
      "200%",
    );
    await waitFor(() => expect(getMaxHeight()).toBeGreaterThan(initialHeight));

    fireEvent.keyUp(volumeSlider, { key: "End" });
    expect(store.getState().audio.tracks[0]?.processing.volume).toBe(2);
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
    expect(screen.getByRole("menuitem", { name: /audio filters/i })).toBeInTheDocument();
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
    await user.click(screen.getByRole("menuitem", { name: "Waveform display" }));
    expect(await screen.findByRole("menuitemradio", { name: "Peak" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await selectWithKeyboard(user, screen.getByRole("menuitemradio", { name: "RMS" }));

    expect(select).toHaveTextContent("RMS");
    expect(screen.getByRole("menuitemradio", { name: "RMS" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.keyboard("{Escape}");

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });
    await user.click(await screen.findByRole("menuitem", { name: "Waveform display" }));
    expect(await screen.findByRole("menuitemradio", { name: "RMS" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await selectWithKeyboard(user, screen.getByRole("menuitemradio", { name: "Stereo" }));

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
    expect(screen.getByRole("menuitem", { name: /audio filters/i })).toBeInTheDocument();
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

  describe("filters shortcut", () => {
    const shortcut = () => screen.getByRole("button", { name: "Audio filters for track 1" });

    it("is a plain icon button whose color only tells whether the chain has filters", () => {
      const { store } = renderRow();
      expect(shortcut().querySelector("svg")).toBeInTheDocument();
      expect(shortcut()).toHaveClass("text-muted-foreground", "bg-transparent");
      expect(shortcut()).not.toHaveClass("text-foreground");

      act(() => {
        store.dispatch(
          audioTrackFiltersApplied({
            streamIndex: 2,
            filters: [
              { enabled: true, id: "g", type: "gain", gainDb: 3 },
              { enabled: false, id: "h", type: "highPass", cutoffHz: 80 },
            ],
          }),
        );
      });
      expect(shortcut()).toHaveClass("text-foreground", "bg-transparent");
      expect(shortcut()).not.toHaveClass("text-muted-foreground");
      // No counts, names or badges: just the icon.
      expect(shortcut()).toHaveTextContent("");
      expect(shortcut().querySelector("[data-slot='badge']")).toBeNull();
    });

    it("shows its purpose in a tooltip and opens the existing Audio Filters dialog", async () => {
      const user = userEvent.setup();
      renderRow();

      await user.hover(shortcut());
      expect(await screen.findAllByText("Audio filters")).not.toHaveLength(0);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await user.click(shortcut());
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it("is reachable and operable from the keyboard", async () => {
      const user = userEvent.setup();
      renderRow();

      await user.tab();
      await user.tab();
      await user.tab();
      while (document.activeElement !== shortcut()) {
        await user.tab();
        if (document.activeElement === document.body) break;
      }
      expect(shortcut()).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it("stays available, outside the centered status, while the waveform is idle, generating, and failed", () => {
      const { store } = renderRow();
      expect(shortcut()).toBeInTheDocument();

      act(() => {
        store.dispatch(waveformsLoading({ jobId: "job", streamIndexes: [2], width: 2 }));
      });
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByRole("status")).not.toContainElement(shortcut());
      expect(shortcut()).toBeInTheDocument();

      act(() => {
        store.dispatch(
          waveformsFailed({
            jobId: "job",
            streamIndexes: [2],
            width: 2,
            error: {
              code: "waveform_failed",
              messageId: "media.waveform.previewCouldNotBeDisplayed",
            },
          }),
        );
      });
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(shortcut()).toBeInTheDocument();
    });

    it("sits in the waveform's top-left corner, clear of the other corner controls", () => {
      renderRow();
      const corner = shortcut().parentElement!;
      expect(corner).toHaveClass("absolute", "top-0", "left-0");
      expect(corner.closest("[data-enabled]")).toContainElement(
        screen.getByRole("combobox", { name: "Waveform display" }),
      );
      expect(corner).not.toContainElement(
        document.querySelector("[data-slot='audio-track-volume-indicator']"),
      );
    });
  });
});
