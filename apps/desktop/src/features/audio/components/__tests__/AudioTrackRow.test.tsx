import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackToggled,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
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
  it("keeps the menu action-only and discards an unsubmitted effects draft", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /effects/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    expect(screen.getByRole("dialog", { name: /effects/i })).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: /loudness normalization/i }),
      "broadcast",
    );
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
    await user.selectOptions(
      screen.getByRole("combobox", { name: /loudness normalization/i }),
      "streaming",
    );
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: 0,
      loudnessNormalization: "streaming",
    });
    expect(screen.getByRole("note")).toHaveTextContent(/normalize/i);
    expect(screen.queryByRole("spinbutton", { name: /gain/i })).not.toBeInTheDocument();
  });

  it("exposes the same action-only commands in the row context menu", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });

    expect(screen.getByRole("menuitemcheckbox", { name: /mute eng/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /detect audio activity/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /effects/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("commits custom loudness values only when Apply is pressed", async () => {
    const user = userEvent.setup();
    const { store } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /effects/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /loudness normalization/i }),
      "custom",
    );
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

    expect(screen.getByRole("menuitem", { name: /detect audio activity/i })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: /analyze loudness/i })).not.toBeInTheDocument();
  });
});
