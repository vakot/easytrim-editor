import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { chapterAdded, selectChapters } from "@/app/store/slices/chapters-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, media } from "@/test/source.fixtures";

import { ChapterTimelineEditingProvider } from "../../ChapterTimelineEditingProvider";
import { TimelineTrack } from "../TimelineTrack";

const mocks = vi.hoisted(() => ({
  timeline: {
    onChange: vi.fn(),
    onMoveSegment: vi.fn(),
    onScrub: vi.fn(),
    onScrubEnd: vi.fn(),
    onScrubStart: vi.fn(),
    onSeek: vi.fn(),
    onSegmentDragEnd: vi.fn(),
    onSegmentDragStart: vi.fn(),
    onTrimDragEnd: vi.fn(),
    onTrimDragStart: vi.fn(),
    playheadMicros: 0,
    playheadRef: { current: null },
    trim: { endMicros: 5_000_000, sourceDurationMicros: 5_000_000, startMicros: 0 },
  },
}));

vi.mock("@/features/timeline", () => ({
  useTimeline: () => mocks.timeline,
  useTimelineReadiness: () => ({ canInteract: true }),
}));

vi.mock("@/features/audio", () => ({ audioTrackColor: () => "#fff" }));

function renderTimelineTrack() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
  store.dispatch(
    chapterAdded({
      endMicros: 3_000_000,
      id: "chapter-1",
      startMicros: 1_000_000,
      title: "Opening",
    }),
  );

  const view = render(
    <Provider store={store}>
      <ChapterTimelineEditingProvider>
        <TimelineTrack />
      </ChapterTimelineEditingProvider>
    </Provider>,
  );

  return { ...view, store };
}

describe("TimelineTrack chapter editing", () => {
  it("enters focused editing from a chapter marker and disables trim controls", () => {
    const { store } = renderTimelineTrack();

    fireEvent.click(screen.getByRole("button", { name: /Opening/ }));

    expect(screen.getByRole("slider", { name: "Start of Opening" })).toBeEnabled();
    expect(screen.getByRole("slider", { name: "End of Opening" })).toBeEnabled();
    expect(screen.getByRole("slider", { name: "Playback position" })).toBeEnabled();
    expect(screen.getByRole("slider", { name: "Trim start" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Trim end" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Move selected segment" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "5000000",
    );
    expect(mocks.timeline.onSeek).toHaveBeenCalledWith(1_000_000);
    expect(selectChapters(store.getState())[0]?.startMicros).toBe(1_000_000);
  });

  it("updates the active chapter draft through the shared trim handle interaction", () => {
    const { container, store } = renderTimelineTrack();
    fireEvent.click(screen.getByRole("button", { name: /Opening/ }));

    const track = container.querySelector(".segment-markers");
    if (!track) throw new Error("Timeline track not found");
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      bottom: 20,
      height: 20,
      left: 0,
      right: 100,
      toJSON: () => ({}),
      top: 0,
      width: 100,
      x: 0,
      y: 0,
    } as DOMRect);

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Start of Opening" }), {
      button: 0,
      clientX: 36,
      isPrimary: true,
      pointerId: 1,
    });

    expect(screen.getByRole("slider", { name: "Start of Opening" })).toHaveAttribute(
      "aria-valuenow",
      "1800000",
    );
    expect(selectChapters(store.getState())[0]?.startMicros).toBe(1_000_000);
    expect(mocks.timeline.onChange).not.toHaveBeenCalled();
  });
});
