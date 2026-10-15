import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, media } from "@/test/source.fixtures";

import { TimelinePanel } from "../TimelinePanel";

const playback = vi.hoisted(() => ({
  durationMicros: 5_000_000,
  framesCount: 300,
  isPlaying: false,
  pause: vi.fn(),
  play: vi.fn(),
  positionMicros: 2_000_000,
  seekTime: vi.fn(),
  stepFrame: vi.fn(),
  togglePlayback: vi.fn(),
}));

vi.mock("@/features/playback", () => ({
  usePlaybackActions: () => ({
    pause: playback.pause,
    play: playback.play,
    togglePlayback: playback.togglePlayback,
  }),
  usePlaybackIsPlaying: () => playback.isPlaying,
  usePlaybackPosition: (select: (micros: number) => unknown) => select(playback.positionMicros),
  useTimelinePlayback: () => ({
    durationMicros: playback.durationMicros,
    framesCount: playback.framesCount,
    getPositionMicros: () => playback.positionMicros,
    seekTime: playback.seekTime,
    stepFrame: playback.stepFrame,
  }),
}));

/** A 5 s, 60 FPS source: frame boundaries every 16.667 ms. */
function renderPanel({
  end = 5_000_000,
  isPlaying = false,
  loaded = true,
  positionMicros = 2_000_000,
  start = 0,
} = {}) {
  const store = createAppStore();
  if (loaded) {
    const sourceMedia = media(firstSource.sourcePath);
    sourceMedia.video.averageFrameRate = { numerator: 60, denominator: 1, displayValue: 60 };
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: sourceMedia }));
    store.dispatch(
      trimChanged({
        trim: { startMicros: start, endMicros: end, sourceDurationMicros: 5_000_000 },
      }),
    );
  }
  Object.assign(playback, {
    durationMicros: loaded ? 5_000_000 : 0,
    framesCount: loaded ? 300 : 0,
    isPlaying,
    positionMicros,
  });
  for (const mock of [
    playback.pause,
    playback.play,
    playback.seekTime,
    playback.stepFrame,
    playback.togglePlayback,
  ]) {
    mock.mockClear();
  }
  render(
    <Provider store={store}>
      <TooltipProvider>
        <TimelinePanel />
      </TooltipProvider>
    </Provider>,
  );
  return store;
}

/** Lays the timeline's positioning layer out at `left`..`left + width` pixels. */
function layOutTimeline(left = 0, width = 240) {
  const layer = document.querySelector('[data-slot="timeline-layer"]')!;
  vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
    left,
    top: 0,
    width,
    height: 52,
  } as DOMRect);
}

describe("TimelinePanel", () => {
  it("places the playhead in time and reads it out as a timecode", () => {
    renderPanel();

    const playhead = screen.getByRole("slider", { name: "Playhead position" });
    expect(playhead).toHaveAttribute("aria-valuemin", "0");
    expect(playhead).toHaveAttribute("aria-valuemax", "5000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "2000000");
    expect(playhead).toHaveStyle({ left: "40%" });
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent(
      "00:00:02:00f / 00:00:05:00f",
    );
  });

  it("steps frames from the focused playhead and seeks its ends", () => {
    renderPanel();
    const playhead = screen.getByRole("slider", { name: "Playhead position" });

    fireEvent.keyDown(playhead, { key: "ArrowRight" });
    fireEvent.keyDown(playhead, { key: "ArrowLeft" });
    fireEvent.keyDown(playhead, { key: "End" });
    fireEvent.keyDown(playhead, { key: "Home" });

    expect(playback.stepFrame).toHaveBeenNthCalledWith(1, 1);
    expect(playback.stepFrame).toHaveBeenNthCalledWith(2, -1);
    expect(playback.seekTime).toHaveBeenNthCalledWith(1, 5_000_000);
    expect(playback.seekTime).toHaveBeenNthCalledWith(2, 0);
  });

  it("moves by one frame with global arrows and toggles playback with Space", () => {
    renderPanel();

    fireEvent.keyDown(window, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(window, { code: "ArrowLeft", key: "ArrowLeft" });
    fireEvent.keyDown(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });

    expect(playback.stepFrame).toHaveBeenNthCalledWith(1, 1);
    expect(playback.stepFrame).toHaveBeenNthCalledWith(2, -1);
    expect(playback.togglePlayback).toHaveBeenCalledOnce();
  });

  it("leaves transport keys to text entry and open dialogs", () => {
    renderPanel();
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

    expect(playback.stepFrame).not.toHaveBeenCalled();
    expect(playback.togglePlayback).not.toHaveBeenCalled();

    input.remove();
    dialog.remove();
  });

  it("disables the timeline for unloaded media", () => {
    renderPanel({ loaded: false });

    expect(document.querySelector('[data-slot="timeline"]')).toHaveAttribute("data-disabled");
    expect(screen.getByRole("slider", { name: "Playhead position" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("steps one frame from the frame controls and stops them at the timeline ends", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous frame" }));
    expect(playback.stepFrame).toHaveBeenNthCalledWith(1, 1);
    expect(playback.stepFrame).toHaveBeenNthCalledWith(2, -1);
  });

  it.each([
    { positionMicros: 0, disabled: "Previous frame" },
    { positionMicros: 5_000_000, disabled: "Next frame" },
  ])("disables $disabled at the timeline edge", ({ disabled, positionMicros }) => {
    renderPanel({ positionMicros });
    expect(screen.getByRole("button", { name: disabled })).toBeDisabled();
  });

  it("toggles playback from the play control", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(playback.togglePlayback).toHaveBeenCalledOnce();
  });

  it("scrubs to the time under the pointer", () => {
    renderPanel();
    layOutTimeline();
    const timeline = document.querySelector('[data-slot="timeline"]')!;

    fireEvent.pointerDown(timeline, { button: 0, clientX: 60, pointerId: 1 });
    fireEvent.pointerMove(timeline, { clientX: 120, pointerId: 1 });
    fireEvent.pointerUp(timeline, { clientX: 120, pointerId: 1 });

    expect(playback.seekTime).toHaveBeenNthCalledWith(1, 1_250_000);
    expect(playback.seekTime).toHaveBeenNthCalledWith(2, 2_500_000);
  });

  it("shows start, end and duration of the selection as timecodes", () => {
    renderPanel({ start: 1_000_000, end: 3_500_000 });
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(values).toEqual(["00:00:01:00f", "00:00:03:30f", "00:00:02:30f"]);
  });
});

describe("Timeline trim editing", () => {
  it("steps trim boundaries by one real frame without moving playback", () => {
    const store = renderPanel();
    const start = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(store.getState().trim.value?.startMicros).toBe(16_667);
    fireEvent.keyDown(start, { key: "End" });
    expect(store.getState().trim.value?.startMicros).toBe(4_000_000);
    fireEvent.keyDown(start, { key: "Home" });
    expect(store.getState().trim.value?.startMicros).toBe(0);
    expect(playback.seekTime).not.toHaveBeenCalled();
    expect(playback.stepFrame).not.toHaveBeenCalled();
  });

  it("moves the selected segment without changing its length", () => {
    const store = renderPanel({ start: 1_000_000, end: 3_000_000 });
    const move = screen.getByRole("slider", { name: "Move selected segment" });
    fireEvent.keyDown(move, { key: "ArrowRight" });
    expect(store.getState().trim.value).toMatchObject({
      startMicros: 1_016_667,
      endMicros: 3_016_667,
    });
    fireEvent.keyDown(move, { key: "End" });
    expect(store.getState().trim.value).toMatchObject({
      startMicros: 3_000_000,
      endMicros: 5_000_000,
    });
    fireEvent.keyDown(move, { key: "Home" });
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 2_000_000 });
  });

  it("marks In at the frame on screen and Out after it, crossing the opposite edge", () => {
    const store = renderPanel({ end: 1_000_000 });
    fireEvent.keyDown(window, { code: "KeyI", key: "ш" });
    expect(store.getState().trim.value).toMatchObject({
      startMicros: 2_000_000,
      endMicros: 5_000_000,
    });
    // Out on the In frame includes it; the selection keeps its minimum length.
    fireEvent.click(screen.getByRole("button", { name: "Set segment end" }));
    expect(store.getState().trim.value).toMatchObject({
      startMicros: 2_000_000,
      endMicros: 3_000_000,
    });
    fireEvent.keyDown(window, { code: "KeyI", key: "i", repeat: true });
    expect(store.getState().trim.value?.startMicros).toBe(2_000_000);
  });

  it("ends the selection after the Out frame, crossing a later start", () => {
    const store = renderPanel({ start: 3_000_000, end: 5_000_000 });
    fireEvent.click(screen.getByRole("button", { name: "Set segment end" }));
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 2_016_667 });
  });

  it("resets each boundary on double click", () => {
    const store = renderPanel({ start: 1_000_000, end: 3_000_000 });
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Trim start" }));
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Trim end" }));
    expect(store.getState().trim.value).toMatchObject({ startMicros: 0, endMicros: 5_000_000 });
  });

  it("ignores a double click completed by a drag", () => {
    const store = renderPanel({ start: 1_000_000, end: 3_000_000 });
    layOutTimeline();
    const start = screen.getByRole("slider", { name: "Trim start" });

    // Click and release, then click, hold and drag: the second release must not reset.
    fireEvent.pointerDown(start, { button: 0, clientX: 48, pointerId: 1 });
    fireEvent.pointerUp(start, { clientX: 48, pointerId: 1 });
    fireEvent.pointerDown(start, { button: 0, clientX: 48, pointerId: 1 });
    fireEvent.pointerMove(start, { clientX: 72, pointerId: 1 });
    fireEvent.pointerUp(start, { clientX: 72, pointerId: 1 });
    fireEvent.doubleClick(start);

    expect(store.getState().trim.value?.startMicros).toBe(1_500_000);
  });

  it("snaps a dragged boundary to a frame, pauses once, and resumes only prior playback", () => {
    const store = renderPanel({ isPlaying: true });
    layOutTimeline();
    const start = screen.getByRole("slider", { name: "Trim start" });

    fireEvent.pointerDown(start, { button: 0, clientX: 0, pointerId: 1 });
    // 61 px of 240 px is 1.270833 s; the nearest frame boundary is frame 76 at 1.266667 s.
    fireEvent.pointerMove(start, { clientX: 61, pointerId: 1 });
    expect(store.getState().trim.value?.startMicros).toBe(0);
    expect(start).toHaveAttribute("aria-valuenow", "1266667");
    fireEvent.pointerUp(start, { clientX: 61, pointerId: 1 });

    expect(store.getState().trim.value?.startMicros).toBe(1_266_667);
    expect(playback.pause).toHaveBeenCalledOnce();
    expect(playback.play).toHaveBeenCalledOnce();
    expect(playback.seekTime).not.toHaveBeenCalled();
  });

  it("drags the whole selection from where it was grabbed", () => {
    const store = renderPanel({ start: 1_000_000, end: 3_000_000 });
    layOutTimeline();
    const move = screen.getByRole("slider", { name: "Move selected segment" });

    fireEvent.pointerDown(move, { button: 0, clientX: 96, pointerId: 1 });
    fireEvent.pointerMove(move, { clientX: 120, pointerId: 1 });
    fireEvent.pointerUp(move, { clientX: 120, pointerId: 1 });

    expect(store.getState().trim.value).toMatchObject({
      startMicros: 1_500_000,
      endMicros: 3_500_000,
    });
  });

  it("discards a drag when the source is cleared", () => {
    const store = renderPanel({ isPlaying: true });
    const start = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.pointerDown(start, { button: 0, clientX: 0, pointerId: 1 });
    store.dispatch(sourceCleared());
    fireEvent.pointerUp(start, { clientX: 60, pointerId: 1 });
    expect(store.getState().trim.value).toBeNull();
    expect(playback.play).not.toHaveBeenCalled();
  });

  it("cancels captured input on source replacement and permits immediate keyboard editing", () => {
    const store = renderPanel({ isPlaying: true });
    const original = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.pointerDown(original, { button: 0, clientX: 0, pointerId: 1 });
    const sourceMedia = store.getState().source.media!;
    act(() => {
      store.dispatch(sourceSelected({ loadToken: 2, source: firstSource }));
      store.dispatch(sourceReady({ loadToken: 2, media: sourceMedia }));
    });
    const replacement = screen.getByRole("slider", { name: "Trim start" });
    expect(replacement).not.toBe(original);
    fireEvent.keyDown(replacement, { key: "ArrowRight" });
    fireEvent.pointerUp(original, { clientX: 100, pointerId: 1 });
    expect(store.getState().trim.value?.startMicros).toBe(16_667);
    expect(playback.play).not.toHaveBeenCalled();
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)(
    "finalizes the last draft on %s without starting paused playback",
    (event) => {
      const store = renderPanel();
      layOutTimeline();
      const start = screen.getByRole("slider", { name: "Trim start" });
      fireEvent.pointerDown(start, { button: 0, clientX: 0, pointerId: 1 });
      fireEvent.pointerMove(start, { clientX: 72, pointerId: 1 });
      fireEvent[event](start, { clientX: 200, pointerId: 1 });
      expect(store.getState().trim.value?.startMicros).toBe(1_500_000);
      expect(playback.play).not.toHaveBeenCalled();
    },
  );

  it("snaps a Shift-dragged trim boundary to the playhead", () => {
    // Playhead at 2 s is 96 px on a 240 px timeline; 100 px is within the snap distance.
    const store = renderPanel({ positionMicros: 2_000_000 });
    layOutTimeline();
    const start = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.pointerDown(start, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(start, { clientX: 100, pointerId: 1, shiftKey: true });
    expect(start).toHaveAttribute("data-snap-active");
    fireEvent.pointerUp(start, { clientX: 100, pointerId: 1 });
    expect(start).not.toHaveAttribute("data-snap-active");
    expect(store.getState().trim.value?.startMicros).toBe(2_000_000);
  });

  it("keeps a Shift-dragged boundary on the timeline edge across pointer moves", () => {
    const store = renderPanel({ start: 1_000_000, end: 3_000_000 });
    layOutTimeline();
    const end = screen.getByRole("slider", { name: "Trim end" });
    fireEvent.pointerDown(end, { button: 0, clientX: 144, pointerId: 1 });
    const positions = [];
    for (const clientX of [236, 237, 238, 237, 236]) {
      fireEvent.pointerMove(end, { clientX, pointerId: 1, shiftKey: true });
      positions.push(end.getAttribute("aria-valuenow"));
    }
    fireEvent.pointerUp(end, { clientX: 236, pointerId: 1 });
    expect(new Set(positions)).toEqual(new Set(["5000000"]));
    expect(store.getState().trim.value?.endMicros).toBe(5_000_000);
  });

  it("snaps a Shift-scrubbed playhead to the selection's move knob", () => {
    renderPanel({ start: 1_000_000, end: 3_000_000, positionMicros: 0 });
    layOutTimeline();
    const timeline = document.querySelector('[data-slot="timeline"]')!;
    // The knob sits at 2 s (96 px); the pointer is 4 px away.
    fireEvent.pointerDown(timeline, { button: 0, clientX: 100, pointerId: 1, shiftKey: true });
    expect(playback.seekTime).toHaveBeenLastCalledWith(2_000_000);
    const playhead = screen.getByRole("slider", { name: "Playhead position" });
    expect(playhead).toHaveAttribute("data-snap-active");
    fireEvent.pointerMove(timeline, { clientX: 100, pointerId: 1 });
    expect(playhead).not.toHaveAttribute("data-snap-active");
    fireEvent.pointerUp(timeline, { clientX: 100, pointerId: 1 });
  });
});
