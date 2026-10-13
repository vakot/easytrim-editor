import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/store/store";

import { TimelinePanel } from "../TimelinePanel";

const playback = vi.hoisted(() => ({
  currentFrame: 11,
  framesCount: 100,
  isPlaying: false,
  pause: vi.fn(),
  seekFrame: vi.fn(),
  togglePlayback: vi.fn(),
}));

vi.mock("@/features/playback", () => ({
  microsToFrame: () => 0,
  usePlaybackActions: () => ({ pause: playback.pause, togglePlayback: playback.togglePlayback }),
  usePlaybackIsPlaying: () => playback.isPlaying,
  useTimelinePlayback: () => ({
    currentFrame: playback.currentFrame,
    framesCount: playback.framesCount,
    seekFrame: playback.seekFrame,
  }),
}));

function renderTimelinePanel({
  currentFrame = 11,
  framesCount = 100,
  isPlaying = false,
}: {
  currentFrame?: number;
  framesCount?: number;
  isPlaying?: boolean;
} = {}) {
  playback.currentFrame = currentFrame;
  playback.framesCount = framesCount;
  playback.isPlaying = isPlaying;
  playback.pause.mockClear();
  playback.seekFrame.mockClear();
  playback.togglePlayback.mockClear();

  return render(
    <Provider store={createAppStore()}>
      <TimelinePanel />
    </Provider>,
  );
}

describe("TimelinePanel", () => {
  it("uses integer frame values and selects a frame from the playhead", () => {
    renderTimelinePanel();

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "11");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(playback.seekFrame).toHaveBeenCalledWith(12);
  });

  it("disables the slider for unloaded media", () => {
    renderTimelinePanel({ currentFrame: 0, framesCount: 0 });

    expect(screen.getByRole("slider")).toHaveAttribute("data-disabled");
  });

  it("pauses and moves one frame when a frame control is selected", () => {
    renderTimelinePanel({ isPlaying: true });

    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));

    expect(playback.pause).toHaveBeenCalledOnce();
    expect(playback.seekFrame).toHaveBeenCalledWith(12);
  });

  it("sets playback state from the play control", () => {
    renderTimelinePanel();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(playback.togglePlayback).toHaveBeenCalledOnce();
  });
});
