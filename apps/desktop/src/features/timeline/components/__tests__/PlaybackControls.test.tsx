import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FRAME_SHUTTLE_HOLD_DELAY_MS } from "../../lib/editor-shortcuts";
import { PlaybackControls } from "../PlaybackControls";

function TestProvider({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}

afterEach(() => vi.useRealTimers());

describe("PlaybackControls", () => {
  it("steps once on press and starts a held shuttle without a duplicate click", () => {
    vi.useFakeTimers();
    const onShuttleEnd = vi.fn();
    const onShuttleStart = vi.fn();
    const onStepFrame = vi.fn();

    render(
      <PlaybackControls
        canSetSegmentEnd
        canSetSegmentStart
        error={null}
        isPlaying={false}
        onSetSegmentBoundary={vi.fn()}
        onShuttleEnd={onShuttleEnd}
        onShuttleStart={onShuttleStart}
        onStepFrame={onStepFrame}
        onTogglePlayback={vi.fn()}
        shuttleDirection={0}
      />,
      { wrapper: TestProvider },
    );

    const nextFrame = screen.getByRole("button", { name: "Next frame" });
    Object.assign(nextFrame, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(nextFrame, { button: 0, isPrimary: true, pointerId: 7 });
    expect(onStepFrame).toHaveBeenCalledOnce();
    expect(onStepFrame).toHaveBeenCalledWith(1, { type: "button", id: "next-frame" });

    act(() => vi.advanceTimersByTime(FRAME_SHUTTLE_HOLD_DELAY_MS));
    expect(onShuttleStart).toHaveBeenCalledWith(1, {
      type: "button",
      id: "next-frame",
    });

    fireEvent.pointerUp(nextFrame, { button: 0, isPrimary: true, pointerId: 7 });
    fireEvent.click(nextFrame);

    expect(onShuttleEnd).toHaveBeenCalledWith({ type: "button", id: "next-frame" });
    expect(onStepFrame).toHaveBeenCalledOnce();
  });

  it("keeps a quick pointer press as a single-frame step", () => {
    vi.useFakeTimers();
    const onShuttleEnd = vi.fn();
    const onShuttleStart = vi.fn();
    const onStepFrame = vi.fn();

    render(
      <PlaybackControls
        canSetSegmentEnd
        canSetSegmentStart
        error={null}
        isPlaying={false}
        onSetSegmentBoundary={vi.fn()}
        onShuttleEnd={onShuttleEnd}
        onShuttleStart={onShuttleStart}
        onStepFrame={onStepFrame}
        onTogglePlayback={vi.fn()}
        shuttleDirection={0}
      />,
      { wrapper: TestProvider },
    );

    const previousFrame = screen.getByRole("button", { name: "Previous frame" });
    Object.assign(previousFrame, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(previousFrame, { button: 0, isPrimary: true, pointerId: 8 });
    fireEvent.pointerUp(previousFrame, { button: 0, isPrimary: true, pointerId: 8 });
    fireEvent.click(previousFrame);
    act(() => vi.advanceTimersByTime(FRAME_SHUTTLE_HOLD_DELAY_MS));

    expect(onStepFrame).toHaveBeenCalledOnce();
    expect(onStepFrame).toHaveBeenCalledWith(-1, { type: "button", id: "previous-frame" });
    expect(onShuttleStart).not.toHaveBeenCalled();
    expect(onShuttleEnd).not.toHaveBeenCalled();
  });
});
