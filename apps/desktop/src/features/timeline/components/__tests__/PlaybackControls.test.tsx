import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FRAME_SHUTTLE_HOLD_DELAY_MS } from "../../lib/editor-shortcuts";
import { PlaybackControls } from "../PlaybackControls";

const mocks = vi.hoisted(() => ({
  playback: {
    canInteract: true,
    isPlaying: false,
    setSegmentBoundary: vi.fn(),
    shuttleDirection: 0 as -1 | 0 | 1,
    startShuttle: vi.fn(),
    stepFrame: vi.fn(),
    stopShuttle: vi.fn(),
    toggle: vi.fn(),
    transportError: null as string | null,
  },
  timeline: {
    canSetSegmentEnd: true,
    canSetSegmentStart: true,
  },
}));

vi.mock("@/app/hooks/usePlayback", () => ({
  usePlayback: () => mocks.playback,
}));

vi.mock("@/app/hooks/useTimeline", () => ({
  useTimeline: () => mocks.timeline,
}));

function TestProvider({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("PlaybackControls", () => {
  it("steps once on press and starts a held shuttle without a duplicate click", () => {
    vi.useFakeTimers();
    render(<PlaybackControls />, { wrapper: TestProvider });

    const nextFrame = screen.getByRole("button", { name: "Next frame" });
    Object.assign(nextFrame, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(nextFrame, { button: 0, isPrimary: true, pointerId: 7 });
    expect(mocks.playback.stepFrame).toHaveBeenCalledOnce();
    expect(mocks.playback.stepFrame).toHaveBeenCalledWith(1, {
      type: "button",
      id: "next-frame",
    });

    act(() => vi.advanceTimersByTime(FRAME_SHUTTLE_HOLD_DELAY_MS));
    expect(mocks.playback.startShuttle).toHaveBeenCalledWith(1, {
      type: "button",
      id: "next-frame",
    });

    fireEvent.pointerUp(nextFrame, { button: 0, isPrimary: true, pointerId: 7 });
    fireEvent.click(nextFrame);

    expect(mocks.playback.stopShuttle).toHaveBeenCalledWith({
      type: "button",
      id: "next-frame",
    });
    expect(mocks.playback.stepFrame).toHaveBeenCalledOnce();
  });

  it("keeps a quick pointer press as a single-frame step", () => {
    vi.useFakeTimers();
    render(<PlaybackControls />, { wrapper: TestProvider });

    const previousFrame = screen.getByRole("button", { name: "Previous frame" });
    Object.assign(previousFrame, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(previousFrame, { button: 0, isPrimary: true, pointerId: 8 });
    fireEvent.pointerUp(previousFrame, { button: 0, isPrimary: true, pointerId: 8 });
    fireEvent.click(previousFrame);
    act(() => vi.advanceTimersByTime(FRAME_SHUTTLE_HOLD_DELAY_MS));

    expect(mocks.playback.stepFrame).toHaveBeenCalledOnce();
    expect(mocks.playback.stepFrame).toHaveBeenCalledWith(-1, {
      type: "button",
      id: "previous-frame",
    });
    expect(mocks.playback.startShuttle).not.toHaveBeenCalled();
    expect(mocks.playback.stopShuttle).not.toHaveBeenCalled();
  });
});
