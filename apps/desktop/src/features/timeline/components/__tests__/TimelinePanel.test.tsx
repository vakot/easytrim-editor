import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimelineFrameContext } from "../../contexts/timeline-runtime-contexts";
import { TimelinePanel } from "../TimelinePanel";

describe("TimelinePanel", () => {
  it("uses integer frame values and selects a frame from the playhead", () => {
    const setCurrentFrame = vi.fn();
    render(
      <TimelineFrameContext.Provider value={{ currentFrame: 11, framesCount: 100, setCurrentFrame }}>
        <TimelinePanel />
      </TimelineFrameContext.Provider>,
    );

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "99");
    expect(slider).toHaveAttribute("aria-valuenow", "11");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(setCurrentFrame).toHaveBeenCalledWith(12);
  });

  it("disables the slider for unloaded media", () => {
    render(
      <TimelineFrameContext.Provider
        value={{ currentFrame: 0, framesCount: 0, setCurrentFrame: vi.fn() }}
      >
        <TimelinePanel />
      </TimelineFrameContext.Provider>,
    );

    expect(screen.getByRole("slider")).toHaveAttribute("aria-disabled", "true");
  });
});
