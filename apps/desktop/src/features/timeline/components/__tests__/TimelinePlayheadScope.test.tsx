import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimelinePlayheadScope } from "../TimelinePlayheadScope";

const playback = vi.hoisted(() => ({ durationMicros: 5_000_000, positionMicros: 2_000_000 }));

vi.mock("@/features/playback", () => ({
  usePlaybackPosition: (select: (micros: number) => unknown) => select(playback.positionMicros),
  useTimelinePlayback: () => ({ durationMicros: playback.durationMicros }),
}));

describe("TimelinePlayheadScope", () => {
  it("publishes the playhead position along the timeline axis without adding a box", () => {
    render(
      <TimelinePlayheadScope>
        <p>Aligned view</p>
      </TimelinePlayheadScope>,
    );

    const scope = screen.getByText("Aligned view").parentElement!;
    expect(scope).toHaveAttribute("data-slot", "timeline-playhead-scope");
    expect(scope).toHaveClass("contents");
    expect(scope.style.getPropertyValue("--timeline-playhead-position")).toBe("40%");
  });
});
