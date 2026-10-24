import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@easytrim-editor/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { EditorRuntimeTestProvider } from "@/test/editor-runtime-test-provider";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioPanel } from "../AudioPanel";

const { prepareSourceWaveforms } = vi.hoisted(() => ({ prepareSourceWaveforms: vi.fn() }));

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>()),
  prepareSourceWaveforms: (...args: unknown[]) => {
    prepareSourceWaveforms(...args);
    return () => undefined;
  },
}));

function renderPanel() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));

  render(
    <Provider store={store}>
      <ThemeProvider>
        <EditorRuntimeTestProvider>
          <TooltipProvider>
            <AudioPanel />
          </TooltipProvider>
        </EditorRuntimeTestProvider>
      </ThemeProvider>
    </Provider>,
  );

  return { store };
}

describe("AudioPanel", () => {
  it("lists every audio stream with its details under a counted title", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Audio tracks (2)" })).toBeInTheDocument();
    expect(screen.getByText("eng")).toBeInTheDocument();
    expect(screen.getByText("#1 · AAC · stereo · Default")).toBeInTheDocument();
    expect(screen.getByText("Surround")).toBeInTheDocument();
    expect(screen.getByText("#2 · AC3 · 5.1")).toBeInTheDocument();
    expect(screen.getByTestId("audio-tracks-scroll")).toBeInTheDocument();
    expect(prepareSourceWaveforms).toHaveBeenCalledWith(firstSource.sourcePath, [2, 4], 4096);
  });

  it("draws one non-interactive playhead line across the rows from the shared position", () => {
    renderPanel();

    const playheads = document.querySelectorAll('[data-slot="audio-playhead"]');
    expect(playheads).toHaveLength(1);
    expect(playheads[0]).toHaveClass("left-(--timeline-playhead-position)", "border-dashed");

    const grid = playheads[0]!.closest('[data-slot="audio-playhead-grid"]');
    expect(grid).toHaveAttribute("aria-hidden", "true");
    expect(grid).toHaveClass("pointer-events-none", "inset-0");
  });

  it("summarizes the output and toggles merging", async () => {
    const user = userEvent.setup();
    const { store } = renderPanel();

    expect(screen.getByText("2 selected tracks kept separately")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Merge selected tracks" }));

    expect(store.getState().preferences.mergeAudioEnabled).toBe(true);
    expect(screen.getByText("2 selected tracks are merged into one track")).toBeInTheDocument();
  });

  it("mutes and unmutes a track from its toggle", async () => {
    const user = userEvent.setup();
    const { store } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Mute (eng)" }));

    expect(store.getState().audio.tracks[0]?.enabled).toBe(false);
    expect(screen.getByRole("button", { name: "Unmute (eng)" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("1 selected track kept separately")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unmute (eng)" }));

    expect(store.getState().audio.tracks[0]?.enabled).toBe(true);
  });
});
