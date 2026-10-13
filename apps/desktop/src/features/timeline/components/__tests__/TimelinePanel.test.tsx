import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/store/store";

import {
  PlaybackTransportContext,
  TimelineFrameContext,
} from "../../contexts/timeline-runtime-contexts";
import { TimelinePanel } from "../TimelinePanel";

function renderTimelinePanel({
  currentFrame = 11,
  framesCount = 100,
  setCurrentFrame = vi.fn(),
  isPlaying = false,
  setIsPlaying = vi.fn(),
}: {
  currentFrame?: number;
  framesCount?: number;
  setCurrentFrame?: (frame: number) => void;
  isPlaying?: boolean;
  setIsPlaying?: (isPlaying: boolean) => void;
} = {}) {
  return render(
    <Provider store={createAppStore()}>
      <TimelineFrameContext.Provider value={{ currentFrame, framesCount, setCurrentFrame }}>
        <PlaybackTransportContext.Provider value={{ isPlaying, setIsPlaying }}>
          <TimelinePanel />
        </PlaybackTransportContext.Provider>
      </TimelineFrameContext.Provider>
    </Provider>,
  );
}

describe("TimelinePanel", () => {
  it("uses integer frame values and selects a frame from the playhead", () => {
    const setCurrentFrame = vi.fn();
    renderTimelinePanel({ setCurrentFrame });

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "99");
    expect(slider).toHaveAttribute("aria-valuenow", "11");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(setCurrentFrame).toHaveBeenCalledWith(12);
  });

  it("disables the slider for unloaded media", () => {
    renderTimelinePanel({ currentFrame: 0, framesCount: 0 });

    expect(screen.getByRole("slider")).toHaveAttribute("data-disabled");
  });

  it("pauses and moves one frame when a frame control is selected", () => {
    const setCurrentFrame = vi.fn();
    const setIsPlaying = vi.fn();
    renderTimelinePanel({ setCurrentFrame, setIsPlaying, isPlaying: true });

    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));

    expect(setIsPlaying).toHaveBeenCalledWith(false);
    expect(setCurrentFrame).toHaveBeenCalledWith(12);
  });

  it("sets playback state from the play control", () => {
    const setIsPlaying = vi.fn();
    renderTimelinePanel({ setIsPlaying });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(setIsPlaying).toHaveBeenCalledWith(true);
  });
});
