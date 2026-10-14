import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, media } from "@/test/source.fixtures";

import { TimelinePanel } from "../TimelinePanel";

const playback = vi.hoisted(() => ({
  currentFrame: 11,
  framesCount: 100,
  isPlaying: false,
  pause: vi.fn(),
  play: vi.fn(),
  seekFrame: vi.fn(),
  togglePlayback: vi.fn(),
}));

vi.mock("@/features/playback", () => ({
  microsToFrame: () => 0,
  usePlaybackActions: () => ({
    pause: playback.pause,
    play: playback.play,
    togglePlayback: playback.togglePlayback,
  }),
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
      "00:00:00:11 / 00:00:03:10",
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
      "00:00:03:10 / 00:00:03:10",
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

function renderTrim({ end = 5000000, isPlaying = false, start = 0 } = {}) {
  const store = createAppStore();
  const sourceMedia = media(firstSource.sourcePath);
  sourceMedia.video.averageFrameRate = { numerator: 60, denominator: 1, displayValue: 60 };
  sourceMedia.video.frameCount = 300;
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: sourceMedia }));
  store.dispatch(
    trimChanged({ trim: { startMicros: start, endMicros: end, sourceDurationMicros: 5000000 } }),
  );
  playback.currentFrame = 120;
  playback.framesCount = 300;
  playback.isPlaying = isPlaying;
  playback.pause.mockClear();
  playback.play.mockClear();
  playback.seekFrame.mockClear();
  render(
    <Provider store={store}>
      <TimelinePanel />
    </Provider>,
  );
  return store;
}

describe("Timeline trim editing", () => {
  it("uses native Slider keyboard steps without moving Playback", () => {
    const store = renderTrim();
    const start = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(store.getState().trim.value?.startMicros).toBe(16667);
    fireEvent.keyDown(start, { key: "ArrowRight", shiftKey: true });
    expect(store.getState().trim.value?.startMicros).toBe(183333);
    fireEvent.keyDown(start, { key: "PageUp" });
    expect(store.getState().trim.value?.startMicros).toBe(350000);
    fireEvent.keyDown(start, { key: "End" });
    expect(store.getState().trim.value?.startMicros).toBe(4000000);
    fireEvent.keyDown(start, { key: "Home" });
    expect(store.getState().trim.value?.startMicros).toBe(0);
    expect(playback.seekFrame).not.toHaveBeenCalled();
  });

  it("moves the selected segment without changing its frame length", () => {
    const store = renderTrim({ start: 1000000, end: 3000000 });
    const move = screen.getByRole("slider", { name: "Move selected segment" });
    fireEvent.keyDown(move, { key: "ArrowRight", shiftKey: true });
    expect(store.getState().trim.value).toMatchObject({ startMicros: 1166667, endMicros: 3166667 });
    fireEvent.keyDown(move, { key: "End" });
    expect(store.getState().trim.value).toMatchObject({ startMicros: 3000000, endMicros: 5000000 });
    fireEvent.keyDown(move, { key: "Home" });
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 2000000 });
  });

  it("marks in/out with shortcuts and transport buttons, including crossing the opposite edge", () => {
    const store = renderTrim({ end: 1000000 });
    fireEvent.keyDown(window, { code: "KeyI", key: "ш" });
    expect(store.getState().trim.value).toMatchObject({ startMicros: 2000000, endMicros: 5000000 });
    fireEvent.click(screen.getByRole("button", { name: "Set segment end" }));
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 2000000 });
    fireEvent.keyDown(window, { code: "KeyI", key: "i", repeat: true });
    expect(store.getState().trim.value?.startMicros).toBe(0);
  });

  it("resets each boundary on double click", () => {
    const store = renderTrim({ start: 1000000, end: 3000000 });
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Trim start" }));
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Trim end" }));
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 5000000 });
  });

  it("pauses once during dragging, commits on release, and resumes only prior playback", () => {
    const store = renderTrim({ isPlaying: true });
    const start = screen.getByRole("slider", { name: "Trim start" });
    const root = start.closest('[data-slot="slider"]')!;
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 240,
      height: 52,
    } as DOMRect);
    fireEvent.pointerDown(start, { button: 0, pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(start, { pointerId: 1, clientX: 60 });
    expect(store.getState().trim.value?.startMicros).toBe(0);
    expect(start).toHaveAttribute("aria-valuenow", "60");
    fireEvent.pointerUp(start, { pointerId: 1, clientX: 60 });
    expect(store.getState().trim.value?.startMicros).toBe(1000000);
    expect(playback.pause).toHaveBeenCalledOnce();
    expect(playback.play).toHaveBeenCalledOnce();
    expect(playback.seekFrame).not.toHaveBeenCalled();
  });

  it("discards a drag when the source is cleared", () => {
    const store = renderTrim({ isPlaying: true });
    const start = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.pointerDown(start, { button: 0, pointerId: 1, clientX: 0 });
    store.dispatch(sourceCleared());
    fireEvent.pointerUp(start, { pointerId: 1, clientX: 60 });
    expect(store.getState().trim.value).toBeNull();
    expect(playback.play).not.toHaveBeenCalled();
  });

  it("cancels captured input on source replacement and permits immediate keyboard editing", () => {
    const store = renderTrim({ isPlaying: true });
    const original = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.pointerDown(original, { button: 0, pointerId: 1, clientX: 0 });
    const sourceMedia = store.getState().source.media!;
    act(() => {
      store.dispatch(sourceSelected({ loadToken: 2, source: firstSource }));
      store.dispatch(sourceReady({ loadToken: 2, media: sourceMedia }));
    });
    const replacement = screen.getByRole("slider", { name: "Trim start" });
    expect(replacement).not.toBe(original);
    fireEvent.keyDown(replacement, { key: "ArrowRight" });
    fireEvent.pointerUp(original, { pointerId: 1, clientX: 100 });
    expect(store.getState().trim.value?.startMicros).toBe(16667);
    expect(playback.play).not.toHaveBeenCalled();
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)(
    "finalizes the last draft on %s without starting paused playback",
    (event) => {
      const store = renderTrim();
      const start = screen.getByRole("slider", { name: "Trim start" });
      const root = start.closest('[data-slot="slider"]')!;
      vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 240,
        height: 52,
      } as DOMRect);
      fireEvent.pointerDown(start, { button: 0, pointerId: 1, clientX: 0 });
      fireEvent.pointerMove(start, { pointerId: 1, clientX: 90 });
      fireEvent[event](start, { pointerId: 1, clientX: 200 });
      expect(store.getState().trim.value?.startMicros).toBe(1500000);
      expect(playback.play).not.toHaveBeenCalled();
    },
  );
});
