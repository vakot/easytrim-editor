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
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackProcessingChanged,
  audioTrackToggled,
  waveformReady,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { audioTrackLoudnessInputsKey } from "@/domain/audio-processing";
import { audioTrackColor } from "@/features/audio";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackRow } from "../AudioTrack/AudioTrackRow";

vi.mock("@/app/hooks/usePlayback", () => ({
  usePlayback: () => ({
    clearLiveAudioTrackGain: () => undefined,
    setLiveAudioTrackGain: () => undefined,
  }),
}));

function renderRow(enabled = true) {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  const media = mediaWithAudio(firstSource.sourcePath);
  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media }));
  const stream = media.audioStreams[0]!;
  if (!enabled) store.dispatch(audioTrackToggled({ streamIndex: stream.streamIndex }));

  render(
    <Provider store={store}>
      <TooltipProvider>
        <AudioTrackRow streamIndex={stream.streamIndex} />
      </TooltipProvider>
    </Provider>,
  );

  return { store };
}

describe("AudioTrackRow", () => {
  it("scales the existing waveform during live gain adjustment", async () => {
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

    const image = document.querySelector<HTMLImageElement>(".waveform-image");
    expect(image).toHaveAttribute("src", "media://waveform");
    expect(image).toHaveStyle({ transform: "scaleY(1)" });

    await userEvent.setup().hover(screen.getByText(/#1 ·/));
    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });
    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "ArrowRight" });

    expect(image).toHaveAttribute("src", "media://waveform");
    expect(image?.style.transform).toBe("scaleY(1.0592537251772889)");
    expect(store.getState().audio.tracks[0]?.processing.gainDb).toBe(0);

    fireEvent.keyUp(gainSlider, { key: "ArrowRight" });
    fireEvent.keyDown(gainSlider, { key: "End" });
    expect(image?.style.transform).toBe("scaleY(3.9810717055349722)");
    expect(image).toHaveAttribute("src", "media://waveform");
  });

  it("marks gain levels, resets to unity on double-click, and mutes at negative infinity", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.hover(screen.getByText(/#1 ·/));

    const gainSlider = screen.getByRole("slider", { name: /audio 1 gain/i });
    expect(screen.getByText("−∞", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("0 dB", { exact: true })).toBeInTheDocument();

    fireEvent.doubleClick(gainSlider);
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: true,
      processing: { gainDb: 0 },
    });

    gainSlider.focus();
    for (let step = 0; step < 48; step += 1) await user.keyboard("{ARROWLEFT}");
    await waitFor(() => {
      expect(store.getState().audio.tracks[0]).toMatchObject({
        enabled: false,
        processing: { gainDb: -24 },
      });
    });

    gainSlider.focus();
    fireEvent.keyDown(gainSlider, { key: "ArrowRight" });
    expect(gainSlider).toHaveAttribute("aria-valuenow", "-23.5");
    expect(screen.getByRole("button", { name: /mute.*eng/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(store.getState().audio.tracks[0]).toMatchObject({
      enabled: false,
      processing: { gainDb: -24 },
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

  it("applies the effects draft once and shows the committed processing on its waveform", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
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

  it("keeps analysis measurement-only and leaves the clean dialog draft clean", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));

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
    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
  });

  it("places Analyze Loudness in the Advanced section", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));

    const analyzeButton = screen.getByRole("button", { name: /analyze loudness/i });
    expect(
      analyzeButton.closest('[data-slot="audio-track-effects-library-page-advanced"]'),
    ).not.toBeNull();
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
      "Effects are applied in the fixed order shown in the list.",
    );
  });

  it("offers only real presets and preserves the chosen preset while toggling the effect", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
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

  it("blocks Apply while enabled custom values are invalid", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
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
    expect(await screen.findByText("Normalized · Streaming")).toBeInTheDocument();
    expect(await screen.findByText("Target −16 LUFS · peak cap −1.5 dBTP")).toBeInTheDocument();

    await user.hover(screen.getByText(/#1 ·/));
    expect(screen.queryByRole("slider", { name: /audio 1 gain/i })).not.toBeInTheDocument();
    expect(screen.getByText("Normalized · Streaming")).toBeInTheDocument();
    const normalizedTooltip = await screen.findByRole("tooltip");
    expect(normalizedTooltip).toHaveTextContent("Target −16 LUFS · peak cap −1.5 dBTP");
    expect(normalizedTooltip).toHaveTextContent(
      /manual gain is ignored while normalization is enabled/i,
    );

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

  it("exposes the same action-only commands in the row context menu", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });

    expect(screen.getByRole("menuitemcheckbox", { name: /mute.*eng/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /analyze audio activity/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /effects/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
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
    render(
      <Provider store={store}>
        <TooltipProvider>
          <AudioTrackRow streamIndex={2} />
        </TooltipProvider>
      </Provider>,
    );
    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByRole("menuitemcheckbox", { name: /hide detected ranges/i })).toBeChecked();
    expect(screen.queryByRole("menuitemcheckbox", { name: /retry analysis/i })).toBeNull();
  });

  it("commits custom loudness values only when Apply is pressed", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
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

    render(
      <Provider store={store}>
        <TooltipProvider>
          <AudioTrackRow streamIndex={stream.streamIndex} />
        </TooltipProvider>
      </Provider>,
    );

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
