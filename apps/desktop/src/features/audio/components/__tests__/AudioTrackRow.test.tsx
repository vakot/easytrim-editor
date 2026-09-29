import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { audioTrackToggled, type AudioTrackState } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { audioTrackColor } from "@/features/audio";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackRow } from "../AudioTrack/AudioTrackRow";

function renderRow(trackOverride?: AudioTrackState, enabled = true) {
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
  const track = trackOverride ?? store.getState().audio.tracks[0]!;

  const view = render(
    <Provider store={store}>
      <TooltipProvider>
        <AudioTrackRow stream={stream} track={track} trackColor="var(--chart-1)" trackNumber={1} />
      </TooltipProvider>
    </Provider>,
  );

  return { store, view, stream };
}

describe("AudioTrackRow", () => {
  it("edits gain directly in dB and exposes the shared actions in the row menu", async () => {
    const user = userEvent.setup();
    const { store, stream, view } = renderRow();

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));
    const gain = screen.getByRole("spinbutton", { name: /gain/i });
    fireEvent.change(gain, { target: { value: "-3.5" } });
    fireEvent.change(screen.getByRole("combobox", { name: /loudness normalization/i }), {
      target: { value: "broadcast" },
    });
    view.rerender(
      <Provider store={store}>
        <TooltipProvider>
          <AudioTrackRow
            stream={stream}
            track={store.getState().audio.tracks[0]!}
            trackColor="var(--chart-1)"
            trackNumber={1}
          />
        </TooltipProvider>
      </Provider>,
    );

    expect(store.getState().audio.tracks[0]?.processing).toEqual({
      gainDb: -3.5,
      loudnessNormalization: "broadcast",
    });
    expect(screen.getByRole("button", { name: /reset/i })).toBeEnabled();
    expect(screen.getByText(/detect audio activity/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.pointer({ keys: "[MouseRight]", target: screen.getByText(/#1 ·/) });

    expect(screen.getByRole("spinbutton", { name: /gain/i })).toHaveValue(-3.5);
    expect(screen.getByRole("combobox", { name: /loudness normalization/i })).toHaveValue(
      "broadcast",
    );
    expect(screen.getByText(/detect audio activity/i)).toBeInTheDocument();
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
    const baseTrack = store.getState().audio.tracks[0]!;
    const track: AudioTrackState = {
      ...baseTrack,
      activityAnalysis: {
        operationId: "activity-2",
        status: "ready",
        value: [{ startMicros: 1_000_000, endMicros: 2_000_000 }],
      },
    };

    const stream = media.audioStreams[0]!;

    render(
      <Provider store={store}>
        <TooltipProvider>
          <AudioTrackRow
            stream={stream}
            track={track}
            trackColor={audioTrackColor(stream.streamIndex)}
            trackNumber={1}
          />
        </TooltipProvider>
      </Provider>,
    );

    const range = document.querySelector('[data-slot="audio-track-activity-range"]');
    expect(range).toHaveStyle({ backgroundColor: audioTrackColor(stream.streamIndex) });
    expect(range).toHaveStyle({ left: "20%", right: "60%" });
  });

  it("allows muted tracks to run loudness and activity analysis", async () => {
    const user = userEvent.setup();
    renderRow(undefined, false);

    await user.click(screen.getByRole("button", { name: /audio 1 actions/i }));

    expect(screen.getByRole("menuitem", { name: /analyze loudness/i })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /detect audio activity/i })).toBeEnabled();
  });
});
