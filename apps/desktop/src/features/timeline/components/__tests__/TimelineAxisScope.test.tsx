import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePublishTimelineSelection } from "../../contexts/timeline-axis-context";
import { TimelineAxisScope } from "../TimelineAxisScope";

const playback = vi.hoisted(() => ({ durationMicros: 5_000_000, positionMicros: 2_000_000 }));

vi.mock("@/features/playback", () => ({
  usePlaybackPosition: (select: (micros: number) => unknown) => select(playback.positionMicros),
  useTimelinePlayback: () => ({ durationMicros: playback.durationMicros }),
}));

function SelectionPublisher() {
  const publishSelection = usePublishTimelineSelection();
  return (
    <button onClick={() => publishSelection?.(20, 75)} type="button">
      Publish selection
    </button>
  );
}

function renderScope() {
  render(
    <TimelineAxisScope>
      <SelectionPublisher />
    </TimelineAxisScope>,
  );
  return screen.getByRole("button", { name: "Publish selection" }).parentElement!;
}

describe("TimelineAxisScope", () => {
  it("publishes the playhead position along the timeline axis without adding a box", () => {
    const scope = renderScope();

    expect(scope).toHaveAttribute("data-slot", "timeline-axis-scope");
    expect(scope).toHaveClass("contents");
    expect(scope.style.getPropertyValue("--timeline-playhead-position")).toBe("40%");
  });

  it("covers the whole axis until the timeline publishes its selection", () => {
    const scope = renderScope();

    expect(scope.style.getPropertyValue("--timeline-selection-start")).toBe("0%");
    expect(scope.style.getPropertyValue("--timeline-selection-end-inset")).toBe("0%");

    fireEvent.click(screen.getByRole("button", { name: "Publish selection" }));

    expect(scope.style.getPropertyValue("--timeline-selection-start")).toBe("20%");
    expect(scope.style.getPropertyValue("--timeline-selection-end-inset")).toBe("25%");
  });
});
