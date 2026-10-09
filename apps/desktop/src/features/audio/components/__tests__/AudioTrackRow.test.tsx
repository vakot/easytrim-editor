import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackMetadataChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
  waveformReady,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { useTheme } from "@/app/theme/useTheme";
import { audioTrackLoudnessInputsKey, type AudioTrackProcessing } from "@/domain/audio-processing";
import { audioTrackColor } from "@/features/audio";
// eslint-disable-next-line no-restricted-imports -- Test owns a focused audio runtime fixture.
import {
  AudioPlaybackContext,
  type AudioPlaybackContract,
} from "@/features/audio/contexts/audio-playback-context";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackRow } from "../AudioTrack/AudioTrackRow";
import { AudioTrackEffectsDialogContext } from "../AudioTrack/components/AudioTrackEffectsDialog/contexts/audio-track-effects-dialog-context";
import { AudioTrackGainControl } from "../AudioTrack/components/AudioTrackGainControl";

const audioPlayback = {
  audioMeterRef: { current: null },
  audioPlayheadRef: { current: null },
  clearLiveAudioTrackGain: () => undefined,
  setLiveAudioTrackGain: () => undefined,
} satisfies AudioPlaybackContract;

function renderRow(
  enabled = true,
  streamIndex = 2,
  sourceLanguage: string | undefined = "eng",
  showColorPreview = false,
) {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  const media = mediaWithAudio(firstSource.sourcePath);
  media.audioStreams[0]!.language = sourceLanguage;
  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media }));
  const stream = media.audioStreams[0]!;
  if (!enabled) store.dispatch(audioTrackToggled({ streamIndex: stream.streamIndex }));

  renderTrack(store, streamIndex, showColorPreview);

  return { store };
}

function renderTrack(
  store: ReturnType<typeof createAppStore>,
  streamIndex: number,
  showColorPreview = false,
) {
  render(
    <Provider store={store}>
      <ThemeProvider>
        <AudioPlaybackContext.Provider value={audioPlayback}>
          <TooltipProvider>
            {showColorPreview && <PrimaryColorPreviewButton />}
            <AudioTrackRow streamIndex={streamIndex} />
          </TooltipProvider>
        </AudioPlaybackContext.Provider>
      </ThemeProvider>
    </Provider>,
  );
}

function PrimaryColorPreviewButton() {
  const { previewPrimaryColor } = useTheme();

  return (
    <button onClick={() => previewPrimaryColor("#123456")} type="button">
      Preview primary color
    </button>
  );
}

function renderGainControl(enabled = true) {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  const media = mediaWithAudio(firstSource.sourcePath);
  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media }));
  if (!enabled) {
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -6 }));
  }

  const clearLiveAudioTrackGain = vi.fn();
  const setLiveAudioTrackGain = vi.fn();
  const openEffects = vi.fn();
  const gainCommits: number[] = [];
  const dispatch = store.dispatch;
  store.dispatch = ((action: Parameters<typeof dispatch>[0]) => {
    if (audioTrackGainChanged.match(action)) gainCommits.push(action.payload.gainDb);
    return dispatch(action);
  }) as typeof store.dispatch;

  render(
    <Provider store={store}>
      <AudioPlaybackContext.Provider
        value={{ ...audioPlayback, clearLiveAudioTrackGain, setLiveAudioTrackGain }}
      >
        <AudioTrackEffectsDialogContext.Provider value={{ openEffects }}>
          <TooltipProvider>
            <AudioTrackGainControl
              onLiveGainChange={() => undefined}
              streamIndex={2}
              trackNumber={1}
            />
          </TooltipProvider>
        </AudioTrackEffectsDialogContext.Provider>
      </AudioPlaybackContext.Provider>
    </Provider>,
  );

  return { clearLiveAudioTrackGain, gainCommits, setLiveAudioTrackGain, store };
}

describe("AudioTrackRow", () => {
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
    const { clearLiveAudioTrackGain, gainCommits, store } = renderGainControl(false);
    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });

    fireEvent.doubleClick(gainSlider);

    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { gainDb: 0 },
    });
    expect(clearLiveAudioTrackGain).toHaveBeenLastCalledWith(2);
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

  it("cancels manual Gain edits on Escape without committing", async () => {
    const user = userEvent.setup();
    const { clearLiveAudioTrackGain, gainCommits, setLiveAudioTrackGain, store } =
      renderGainControl();

    await user.click(screen.getByRole("button", { name: /0 dB/i }));
    const gainInput = screen.getByRole("spinbutton", { name: /audio 1 gain/i });
    await user.clear(gainInput);
    await user.type(gainInput, "-10");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("spinbutton", { name: /audio 1 gain/i })).not.toBeInTheDocument();
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(0);
    expect(gainCommits).toEqual([]);
    expect(setLiveAudioTrackGain).toHaveBeenLastCalledWith(2, -10);
    expect(clearLiveAudioTrackGain).toHaveBeenCalledWith(2);
  });

  it("clamps live Gain previews and commits while keeping the typed value visible", async () => {
    const user = userEvent.setup();
    const { gainCommits, setLiveAudioTrackGain, store } = renderGainControl();

    await user.click(screen.getByRole("button", { name: /0 dB/i }));
    const gainInput = screen.getByRole("spinbutton", { name: /audio 1 gain/i });
    await user.clear(gainInput);
    await user.type(gainInput, "100");

    expect(gainInput).toHaveValue("100");
    expect(setLiveAudioTrackGain).toHaveBeenLastCalledWith(2, 24);
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
    expect((lowerGainInput as HTMLInputElement).value).toBe("");
    expect(setLiveAudioTrackGain).toHaveBeenLastCalledWith(2, 24);

    await user.type(lowerGainInput, "-");
    expect(lowerGainInput).toHaveValue("-");
    expect(setLiveAudioTrackGain).toHaveBeenLastCalledWith(2, 24);
    await user.clear(lowerGainInput);
    await user.paste("-100");
    expect(lowerGainInput).toHaveValue("-100");
    expect(setLiveAudioTrackGain).toHaveBeenLastCalledWith(2, -60);
    fireEvent.blur(lowerGainInput);

    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(-60);
    expect(gainCommits).toEqual([24, -60]);
  });

  it("shows normalization levels and blocks manual Gain changes while active", async () => {
    const user = userEvent.setup();
    const { gainCommits, store } = renderGainControl();
    act(() => {
      store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -2.5 }));
      store.dispatch(
        audioTrackProcessingChanged({
          streamIndex: 2,
          processing: { gainDb: -2.5, loudnessNormalization: "streaming" },
        }),
      );
    });

    expect(screen.queryByRole("slider", { name: /audio 1 gain/i })).not.toBeInTheDocument();
    const normalizationSummary = screen.getByText("−16 LUFS · −1.5 dBTP");

    const gainCommitCount = gainCommits.length;
    await user.hover(normalizationSummary);
    expect(
      await screen.findByText(
        "Manual Gain is unavailable while automatic normalization is applied",
      ),
    ).toBeInTheDocument();

    fireEvent.doubleClick(normalizationSummary);
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: -2.5, loudnessNormalization: "streaming" },
    });
    expect(gainCommits).toHaveLength(gainCommitCount);
  });

  it("opens Audio Effects directly on Loudness Normalization from the disabled Gain control", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    act(() => {
      store.dispatch(
        audioTrackProcessingChanged({
          streamIndex: 2,
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
        }),
      );
    });

    await user.hover(screen.getByRole("button", { name: /mute.*eng/i }));
    const normalizationTrigger = screen.getByRole("button", { name: /loudness normalization/i });
    await user.hover(normalizationTrigger);
    expect(
      await screen.findByText(
        "Manual Gain is unavailable while automatic normalization is applied",
      ),
    ).toBeInTheDocument();
    await user.click(normalizationTrigger);

    const normalizationTab = screen.getByRole("tab", { name: /loudness normalization/i });
    expect(normalizationTab).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: /high-pass filter/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await user.hover(screen.getByRole("button", { name: /mute.*eng/i }));
    await user.click(screen.getByRole("button", { name: /loudness normalization/i }));

    expect(screen.getByRole("tab", { name: /loudness normalization/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("smoothly retargets waveform amplitudes during rapid gain adjustments", async () => {
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      lineTo,
      moveTo,
      set lineWidth(_value: number) {},
      set strokeStyle(_value: string) {},
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 128,
      height: 50,
    } as DOMRect);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => {
          const buffer = new ArrayBuffer(12 + 10 * 2);
          const view = new DataView(buffer);
          view.setUint8(0, 0x45);
          view.setUint8(1, 0x54);
          view.setUint8(2, 0x57);
          view.setUint8(3, 0x46);
          view.setUint16(4, 1, true);
          view.setUint16(6, 1, true);
          view.setUint32(8, 1_280, true);
          for (let run = 0; run < 10; run += 1) {
            view.setUint8(12 + run * 2, 0xff);
            view.setUint8(13 + run * 2, 128);
          }
          return buffer;
        },
      }),
    );

    const { store } = renderRow();
    act(() => {
      store.dispatch(waveformsLoading({ jobId: "waveform-1", streamIndexes: [2], width: 1280 }));
      store.dispatch(
        waveformReady({
          jobId: "waveform-1",
          status: "ready",
          streamIndex: 2,
          url: "media://waveform",
          width: 1280,
        }),
      );
    });

    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    await waitFor(() => expect(lineTo).toHaveBeenCalled());
    const getMaxHeight = () =>
      Math.max(
        ...lineTo.mock.calls.map((call, index) => {
          const top = moveTo.mock.calls[index]?.[1] as number;
          return (call[1] as number) - top;
        }),
      );

    const initialHeight = getMaxHeight();

    await userEvent.setup().hover(screen.getByRole("button", { name: /mute.*eng/i }));
    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });
    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "ArrowRight" });
    expect(getMaxHeight()).toBe(initialHeight);
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(0.5);

    await waitFor(() => {
      expect(getMaxHeight()).toBeGreaterThan(initialHeight);
    });

    fireEvent.keyUp(gainSlider, { key: "ArrowRight" });
    fireEvent.keyDown(gainSlider, { key: "End" });
    expect(getMaxHeight()).toBeGreaterThan(initialHeight);
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(12);
    await waitFor(() => expect(getMaxHeight()).toBeGreaterThan(24));

    const drawnLineCount = lineTo.mock.calls.length;
    act(() => store.dispatch(audioTrackToggled({ streamIndex: 2 })));
    expect(canvas?.parentElement).toHaveAttribute("data-enabled", "false");
    expect(canvas?.parentElement).toHaveClass("data-[enabled=false]:opacity-50");
    expect(lineTo).toHaveBeenCalledTimes(drawnLineCount);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the live PrimaryColor preview for the waveform", async () => {
    const strokeStyle = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      set globalAlpha(_value: number) {},
      set lineWidth(_value: number) {},
      set strokeStyle(value: string) {
        strokeStyle(value);
      },
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 32,
      height: 24,
    } as DOMRect);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => {
          const buffer = new ArrayBuffer(14);
          const view = new DataView(buffer);
          view.setUint8(0, 0x45);
          view.setUint8(1, 0x54);
          view.setUint8(2, 0x57);
          view.setUint8(3, 0x46);
          view.setUint16(4, 1, true);
          view.setUint16(6, 0, true);
          view.setUint32(8, 2, true);
          view.setUint8(12, 128);
          view.setUint8(13, 128);
          return buffer;
        },
      }),
    );

    const { store } = renderRow(true, 2, "eng", true);
    const currentTrim = selectTrim(store.getState())!;
    const selectedTrim = {
      ...currentTrim,
      endMicros: currentTrim.sourceDurationMicros * 0.75,
      startMicros: currentTrim.sourceDurationMicros * 0.25,
    };

    act(() => {
      store.dispatch(trimChanged({ trim: selectedTrim }));
      store.dispatch(waveformsLoading({ jobId: "waveform-color", streamIndexes: [2], width: 2 }));
      store.dispatch(
        waveformReady({
          jobId: "waveform-color",
          status: "ready",
          streamIndex: 2,
          url: "media://waveform-color",
          width: 2,
        }),
      );
    });
    await waitFor(() => expect(strokeStyle).toHaveBeenCalledWith("rgb(239 191 4)"));
    const outsideStart = document.querySelector<HTMLElement>(
      '[data-slot="audio-waveform-outside-selection"][data-edge="start"]',
    );

    const outsideEnd = document.querySelector<HTMLElement>(
      '[data-slot="audio-waveform-outside-selection"][data-edge="end"]',
    );

    expect(outsideStart).toHaveStyle({ left: "0%", width: "25%" });
    expect(outsideEnd).toHaveStyle({ left: "75%", right: "0%" });

    fireEvent.click(screen.getByRole("button", { name: /preview primary color/i }));

    await waitFor(() => expect(strokeStyle).toHaveBeenCalledWith("rgb(18 52 86)"));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("marks the Gain range, resets to unity, and preserves mute state at −24 dB", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.hover(screen.getByRole("button", { name: /mute.*eng/i }));

    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });
    expect(screen.getByText("-24", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("12", { exact: true })).toBeInTheDocument();
    expect(gainSlider).toHaveAttribute("aria-valuemin", "-24");
    expect(gainSlider).toHaveAttribute("aria-valuemax", "12");

    fireEvent.doubleClick(gainSlider);
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: 0 },
    });

    gainSlider.focus();
    for (let step = 0; step < 48; step += 1) await user.keyboard("{ARROWLEFT}");
    await waitFor(() => {
      expect(store.getState().audio.tracks[0]).toMatchObject({
        enabled: true,
        processing: { gainDb: -24 },
      });
    });
    expect(gainSlider).toHaveAttribute("aria-valuenow", "-24");
    expect(screen.getAllByText("−24.0 dB")).toHaveLength(2);

    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "ArrowRight" });
    expect(gainSlider).toHaveAttribute("aria-valuenow", "-23.5");
    expect(screen.getByRole("button", { name: /mute.*eng/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: -23.5 },
    });

    fireEvent.keyUp(gainSlider, { key: "ArrowRight" });
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: -23.5 },
    });

    await user.click(screen.getByRole("button", { name: /mute.*eng/i }));
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { gainDb: -23.5 },
    });

    await user.click(screen.getByRole("button", { name: /unmute.*eng/i }));
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: -23.5 },
    });
  });

  it("keeps the menu action-only and discards an unsubmitted effects draft", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /effects/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    expect(screen.getByRole("dialog", { name: /effects/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /high-pass filter/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("combobox", { name: /loudness normalization/i }));
    expect(
      screen.getByRole("option", { name: /streaming.*−16 LUFS.*−1.5 dBTP/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /broadcast/i }));
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
  });

  it("explains why the default track action is disabled", async () => {
    const user = userEvent.setup();
    renderRow(false);

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

  it("applies the effects draft once and shows the committed processing on its waveform", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("combobox", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("option", { name: /streaming/i }));
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: 0,
      loudnessNormalization: "streaming",
    });
    expect(document.querySelector('[data-slot="audio-track-effects-indicator"]')).toHaveTextContent(
      /normalize/i,
    );
    expect(screen.queryByRole("spinbutton", { name: /gain/i })).not.toBeInTheDocument();
  });

  it("enables the high-pass filter with its default cutoff and shows the active effect", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /high-pass filter/i }));
    await user.click(screen.getByRole("switch", { name: /high-pass filter/i }));
    expect(screen.getByRole("slider", { name: /cutoff frequency/i })).toHaveAttribute(
      "aria-valuetext",
      "80 Hz",
    );

    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: 0,
      effects: [{ cutoffHz: 80, stage: "cleanup", type: "highPass" }],
    });
    expect(store.getState().audio.tracks[1]?.processing).toEqual({ gainDb: 0 });
    expect(document.querySelector('[data-slot="audio-track-effects-indicator"]')).toHaveTextContent(
      /high-pass.*80 hz/i,
    );
  });

  it("summarizes only the cleanup-stage high-pass effect", () => {
    const { store } = renderRow();
    const laterStageEffects: AudioTrackProcessing = {
      effects: [
        { cutoffHz: 100, stage: "dynamics", type: "highPass" },
        { cutoffHz: 120, stage: "finalProtection", type: "highPass" },
      ],
      gainDb: 0,
    };

    act(() => {
      store.dispatch(
        audioTrackProcessingChanged({ processing: laterStageEffects, streamIndex: 2 }),
      );
    });
    expect(
      document.querySelector('[data-slot="audio-track-effects-indicator"]'),
    ).not.toBeInTheDocument();

    act(() => {
      store.dispatch(
        audioTrackProcessingChanged({
          processing: {
            ...laterStageEffects,
            effects: [
              { cutoffHz: 80, stage: "cleanup", type: "highPass" },
              ...(laterStageEffects.effects ?? []),
            ],
          },
          streamIndex: 2,
        }),
      );
    });
    expect(document.querySelector('[data-slot="audio-track-effects-indicator"]')).toHaveTextContent(
      /high-pass.*80 hz/i,
    );
  });

  it("keeps analysis measurement-only and leaves the clean dialog draft clean", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));

    const trim = selectTrim(store.getState())!;
    const cacheKey = audioTrackLoudnessInputsKey(firstSource.sourcePath, 2, trim, {
      gainDb: 0,
      loudnessNormalization: "streaming",
    });

    act(() => {
      store.dispatch(
        audioTrackLoudnessAnalysisStarted({ cacheKey, operationId: "loudness-1", streamIndex: 2 }),
      );
      store.dispatch(
        audioTrackLoudnessAnalysisReady({
          cacheKey,
          operationId: "loudness-1",
          result: {
            integratedLufs: -20,
            truePeakDb: -2,
            inputLra: 4,
            inputThreshold: -30,
          },
          streamIndex: 2,
        }),
      );
    });

    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
    expect(screen.getByRole("status").closest("fieldset")).toBeNull();
    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
  });

  it("keeps loudness measurement controls outside the disabled effect fieldset", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));

    const analyzeButton = screen.getByRole("button", { name: /analyze loudness/i });
    const currentCacheKey = audioTrackLoudnessInputsKey(
      firstSource.sourcePath,
      2,
      selectTrim(store.getState())!,
      { gainDb: 0 },
    );

    const fieldset = document.querySelector("fieldset:disabled");

    const description = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="audio-track-effects-library-page-description"]',
      ),
    ).find(
      (element) => element.textContent === "Normalize this track to a consistent target loudness",
    );

    expect(fieldset).not.toBeNull();
    expect(analyzeButton).toBeEnabled();
    expect(analyzeButton.closest("fieldset")).toBeNull();
    expect(analyzeButton.closest('[data-slot="audio-track-loudness-measurement"]')).not.toBeNull();
    expect(description?.querySelector("[data-slot='audio-track-loudness-measurement']")).toBeNull();
    expect(
      description?.parentElement?.querySelector('[data-slot="audio-track-loudness-measurement"]'),
    ).not.toBeNull();

    act(() => {
      store.dispatch(
        audioTrackLoudnessAnalysisStarted({
          cacheKey: currentCacheKey,
          operationId: "failed-analysis-1",
          streamIndex: 2,
        }),
      );
      store.dispatch(
        audioTrackLoudnessAnalysisFailed({
          cacheKey: currentCacheKey,
          error: {
            code: "render_failed",
            messageId: "media.loudness.ffmpegCouldNotAnalyzeAudioLoudness",
          },
          operationId: "failed-analysis-1",
          streamIndex: 2,
        }),
      );
    });
    expect(screen.getByRole("alert").closest("fieldset")).toBeNull();
  });

  it("places the unapplied changes notice in the dialog footer", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));

    const notice = screen.getByText(/changes stay unapplied until you choose apply/i);
    expect(notice).toHaveClass("text-xs", "text-muted-foreground");
    expect(notice.closest('[data-slot="dialog-footer"]')).not.toBeNull();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Effects are applied in the fixed order shown in the list",
    );
  });

  it("offers only real presets and preserves the chosen preset while toggling the effect", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));
    const preset = screen.getByRole("combobox", { name: /loudness normalization/i });
    await user.click(preset);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Web Video/),
        expect.stringMatching(/Streaming/),
        expect.stringMatching(/Broadcast/),
        expect.stringMatching(/Custom/),
      ]),
    );
    expect(screen.queryByRole("option", { name: /default|off|none/i })).toBeNull();
    await user.click(screen.getByRole("option", { name: /broadcast/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    expect(preset).toHaveTextContent(/broadcast/i);
    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(store.getState().audio.tracks[0]?.processing.loudnessNormalization).toBe("broadcast");
  });

  it("clears Apply for a disabled normalization no-op and keeps its dormant preset", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));

    const apply = screen.getByRole("button", { name: /apply/i });
    const toggle = screen.getByRole("switch", { name: /loudness normalization/i });
    expect(apply).toBeDisabled();

    await user.click(toggle);
    await user.click(screen.getByRole("combobox", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("option", { name: /broadcast/i }));
    expect(apply).toBeEnabled();

    await user.click(toggle);
    await waitFor(() => expect(apply).toBeDisabled());
    expect(screen.getByRole("combobox", { name: /loudness normalization/i })).toHaveTextContent(
      /broadcast/i,
    );

    await user.click(toggle);
    await waitFor(() => expect(apply).toBeEnabled());
    expect(screen.getByRole("combobox", { name: /loudness normalization/i })).toHaveTextContent(
      /broadcast/i,
    );
  });

  it("preserves the limiter ceiling when it is disabled and re-enabled", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /limiter/i }));

    const toggle = screen.getByRole("switch", { name: /limiter/i });
    await user.click(toggle);
    const ceiling = screen.getByRole("slider", { name: /output ceiling/i });
    ceiling.focus();
    await user.keyboard("{ARROWLEFT}");
    expect(ceiling).toHaveAttribute("aria-valuetext", "−2 dB");

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByRole("slider", { name: /output ceiling/i })).toHaveAttribute(
      "aria-valuetext",
      "−2 dB",
    );
    expect(screen.getByRole("button", { name: /apply/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(store.getState().audio.tracks[0]?.processing.effects).toEqual([
      { ceilingDb: -2, stage: "finalProtection", type: "limiter" },
    ]);
  });

  it("blocks Apply while enabled custom values are invalid", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("combobox", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("option", { name: /custom/i }));
    await user.clear(screen.getByRole("spinbutton", { name: /target loudness/i }));
    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
  });

  it("preserves dormant manual gain and shows normalization status in both passive and hover views", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    act(() => {
      store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -2.5 }));
      store.dispatch(
        audioTrackProcessingChanged({
          streamIndex: 2,
          processing: { gainDb: -2.5, loudnessNormalization: "streaming" },
        }),
      );
    });

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: -2.5,
      loudnessNormalization: "streaming",
    });
    expect(await screen.findByText("Normalized - Streaming")).toBeInTheDocument();
    expect(await screen.findByText("−16 LUFS · −1.5 dBTP")).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: /mute.*eng/i }));
    expect(screen.getByText("Normalized - Streaming")).toBeInTheDocument();
    const normalizedSummary = screen.getAllByText("−16 LUFS · −1.5 dBTP").at(-1);
    await user.hover(normalizedSummary!);
    expect(
      await screen.findByText(
        "Manual Gain is unavailable while automatic normalization is applied",
      ),
    ).toBeInTheDocument();

    act(() => {
      store.dispatch(audioTrackProcessingChanged({ streamIndex: 2, processing: { gainDb: -2.5 } }));
    });
    await waitFor(() => {
      expect(screen.getByRole("slider", { name: /audio 1 gain/i })).toHaveAttribute(
        "aria-valuenow",
        "-2.5",
      );
    });
    expect(screen.getAllByText("−2.5 dB")).toHaveLength(2);
  });

  it("shows effect summaries in canonical pipeline order and uses cleanup High Pass", () => {
    const { store } = renderRow();
    act(() => {
      store.dispatch(
        audioTrackProcessingChanged({
          streamIndex: 2,
          processing: {
            gainDb: 0,
            loudnessNormalization: "streaming",
            effects: [
              { ceilingDb: -1, stage: "finalProtection", type: "limiter" },
              { cutoffHz: 120, stage: "dynamics", type: "highPass" },
              { preset: "medium", stage: "cleanup", type: "noiseReduction" },
              { cutoffHz: 100, stage: "cleanup", type: "highPass" },
            ],
          },
        }),
      );
    });

    const indicator = document.querySelector('[data-slot="audio-track-effects-indicator"]');
    const summary = indicator?.textContent ?? "";

    expect(summary).toContain("High-pass (100 Hz)");
    expect(summary).toContain("Noise reduction");
    expect(summary).toContain("Normalized");
    expect(summary).toContain("Limiter");
    expect(summary.indexOf("High-pass (100 Hz)")).toBeLessThan(summary.indexOf("Noise reduction"));
    expect(summary.indexOf("Noise reduction")).toBeLessThan(summary.indexOf("Normalized"));
    expect(summary.indexOf("Normalized")).toBeLessThan(summary.indexOf("Limiter"));
    expect(summary).not.toContain("120 Hz");
  });

  it("exposes the same action-only commands in the row context menu", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });

    expect(screen.getByText("Enable")).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Enable" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /analyze audio activity/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /effects/i })).toBeInTheDocument();
    const defaultAction = screen.getByRole("menuitemcheckbox", { name: "Default" });
    expect(defaultAction).toBeInTheDocument();
    expect(defaultAction).not.toHaveAttribute("aria-disabled", "true");
    expect(defaultAction.parentElement).not.toHaveAttribute("data-slot", "tooltip-trigger");
    expect(screen.getByRole("menuitem", { name: /edit output metadata/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it("uses the source title as the placeholder and inherits it when submitted empty", async () => {
    const user = userEvent.setup();
    const { store } = renderRow(true, 4);
    expect(screen.getByText("Surround")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /audio 2 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const titleInput = screen.getByLabelText("Track title");
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "Surround");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByText("Surround")).toBeInTheDocument();
    expect(
      store.getState().audio.tracks.find((track) => track.streamIndex === 4)?.metadata.title,
    ).toBeUndefined();
  });

  it("preserves an untouched title while editing language and allows an explicit title reset", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    store.dispatch(
      audioTrackMetadataChanged({ streamIndex: 2, title: "Custom title", language: "rus" }),
    );

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata).toEqual({
      isDefault: true,
      title: "Custom title",
      language: "rus",
    });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(screen.getByRole("button", { name: /use source language/i }));
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("English");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata).toMatchObject({
      title: "Custom title",
      language: undefined,
    });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByRole("option", { name: "Русский (Russian), ru" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata).toMatchObject({
      title: "Custom title",
      language: "rus",
    });

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const titleInput = screen.getByLabelText("Track title");
    await user.type(titleInput, "Temporary title");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.title).toBeUndefined();
    expect(store.getState().audio.tracks[0]?.metadata.language).toBe("rus");
  });

  it("uses the latest committed track name in the Effects dialog and restores its source fallback", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.type(screen.getByLabelText("Track title"), "Custom track title");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByRole("button", { name: /mute.*custom track title/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    expect(
      screen.getByRole("dialog", { name: "Custom track title — Effects" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.clear(screen.getByLabelText("Track title"));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    expect(screen.getByRole("dialog", { name: "eng — Effects" })).toBeInTheDocument();
  });

  it("selects and resets a language override using source metadata codes", async () => {
    const user = userEvent.setup();
    const { store } = renderRow(true, 2);

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const selector = screen.getByRole("button", { name: "Language" });
    expect(selector).toHaveTextContent("English");
    await user.click(selector);
    await user.click(screen.getByRole("option", { name: "Русский (Russian), ru" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBe("rus");

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(screen.getByRole("button", { name: /use source language/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.type(screen.getByRole("combobox", { name: /search languages/i }), "French");
    await user.click(screen.getByRole("option", { name: "Français (French), fr" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBe("fra");
  });

  it("clears a language override when the source language is unsupported", async () => {
    const user = userEvent.setup();
    const { store } = renderRow(true, 2, "qaa");

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit output metadata/i }));
    const selector = screen.getByRole("button", { name: "Language" });
    expect(selector).toHaveTextContent("Select a language");
    expect(selector).not.toHaveTextContent("qaa");

    await user.click(selector);
    await user.click(screen.getByRole("option", { name: "Čeština (Czech), cs" }));
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("Čeština");

    await user.click(screen.getByRole("button", { name: /use source language/i }));
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("Select a language");
    expect(screen.getByRole("button", { name: "Language" })).not.toHaveTextContent("ces");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(store.getState().audio.tracks[0]?.metadata.language).toBeUndefined();
  });

  it("uses an action label for the enabled audio track in its dropdown menu", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByText("Enable")).toBeInTheDocument();
  });

  it("allows detected activity ranges to be hidden", async () => {
    const user = userEvent.setup();
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
    store.dispatch(
      audioTrackActivityAnalysisStarted({ operationId: "activity-2", streamIndex: 2 }),
    );
    store.dispatch(
      audioTrackActivityAnalysisReady({
        operationId: "activity-2",
        result: [{ startMicros: 1_000_000, endMicros: 2_000_000 }],
        streamIndex: 2,
      }),
    );
    renderTrack(store, 2);
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByRole("menuitemcheckbox", { name: /show detected ranges/i })).toBeChecked();
    expect(screen.queryByRole("menuitemcheckbox", { name: /retry analysis/i })).toBeNull();
  });

  it("commits custom loudness values only when Apply is pressed", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("combobox", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("option", { name: /custom/i }));
    const target = screen.getByRole("spinbutton", { name: /target loudness/i });
    await user.clear(target);
    await user.type(target, "-18.5");
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });

    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: 0,
      loudnessNormalization: {
        maxTruePeakDb: -1.5,
        mode: "custom",
        targetLufs: -18.5,
      },
    });
  });

  it("switches preset edits to Custom while preserving the other preset value", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.click(screen.getByRole("tab", { name: /loudness normalization/i }));
    await user.click(screen.getByRole("switch", { name: /loudness normalization/i }));
    const target = screen.getByRole("spinbutton", { name: /target loudness/i });
    expect(target).toHaveValue(-14);
    await user.clear(target);
    await user.type(target, "-15");
    expect(screen.getByRole("combobox", { name: /loudness normalization/i })).toHaveTextContent(
      /custom/i,
    );
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: 0,
      loudnessNormalization: {
        maxTruePeakDb: -1,
        mode: "custom",
        targetLufs: -15,
      },
    });
  });

  it("renders detected ranges on their owning waveform in the track color", () => {
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    const media = mediaWithAudio(firstSource.sourcePath);
    store.dispatch(sourceReady({ loadToken: 1, media }));
    const stream = media.audioStreams[0]!;
    store.dispatch(
      audioTrackActivityAnalysisStarted({
        operationId: "activity-2",
        streamIndex: stream.streamIndex,
      }),
    );
    store.dispatch(
      audioTrackActivityAnalysisReady({
        operationId: "activity-2",
        result: [{ startMicros: 1_000_000, endMicros: 2_000_000 }],
        streamIndex: stream.streamIndex,
      }),
    );

    renderTrack(store, stream.streamIndex);

    const range = document.querySelector('[data-slot="audio-track-activity-range"]');
    expect(range).toHaveStyle({ backgroundColor: audioTrackColor(stream.streamIndex) });
    expect(range).toHaveStyle({ left: "20%", right: "60%" });
  });

  it("allows muted tracks to run loudness and activity analysis", async () => {
    const user = userEvent.setup();
    renderRow(false);

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByRole("menuitemcheckbox", { name: /analyze audio activity/i })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: /analyze loudness/i })).not.toBeInTheDocument();
  });
});
