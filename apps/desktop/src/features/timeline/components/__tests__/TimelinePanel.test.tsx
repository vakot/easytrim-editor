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
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent(
      "TC 00:00:00:11 / TC 00:00:03:10",
    );

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(playback.seekFrame).toHaveBeenCalledWith(12);
  });

  it("keeps EOF as the Slider endpoint and displays its timecode without adding a frame", () => {
    renderTimelinePanel({ currentFrame: 100, framesCount: 100 });

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent(
      "TC 00:00:03:10 / TC 00:00:03:10",
    );
    expect(screen.queryByText(/Frame 101/)).not.toBeInTheDocument();
  });

  it("moves by one frame with global arrows and toggles playback with Space", () => {
    renderTimelinePanel();

    fireEvent.keyDown(window, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(window, { code: "ArrowLeft", key: "ArrowLeft" });
    fireEvent.keyDown(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });

    expect(playback.pause).toHaveBeenCalledTimes(2);
    expect(playback.seekFrame).toHaveBeenNthCalledWith(1, 12);
    expect(playback.seekFrame).toHaveBeenNthCalledWith(2, 10);
    expect(playback.togglePlayback).toHaveBeenCalledOnce();
  });

  it("leaves transport keys to text entry and open dialogs", () => {
    renderTimelinePanel();
    const input = document.createElement("input");
    document.body.append(input);

    fireEvent.keyDown(input, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(input, { code: "Space", key: " " });

    const dialog = document.createElement("div");
    dialog.setAttribute("data-state", "open");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    fireEvent.keyDown(window, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(playback.pause).not.toHaveBeenCalled();
    expect(playback.seekFrame).not.toHaveBeenCalled();
    expect(playback.togglePlayback).not.toHaveBeenCalled();

    input.remove();
    dialog.remove();
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
