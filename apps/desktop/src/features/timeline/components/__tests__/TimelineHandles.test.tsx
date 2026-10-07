import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Playhead, SegmentDragHandle, TrimHandle } from "../TimelineHandles";

const range = {
  startMicros: 1_000_000,
  endMicros: 9_000_000,
  sourceDurationMicros: 10_000_000,
};

type HandleKind = "playhead" | "segment" | "trim-end" | "trim-start";

function TimelineHandle({ dragging, kind }: { dragging: boolean; kind: HandleKind }) {
  if (kind === "segment") {
    return (
      <SegmentDragHandle
        dragging={dragging}
        onKeyDown={vi.fn()}
        onLostPointerCapture={vi.fn()}
        onPointerCancel={vi.fn()}
        onPointerDown={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerUp={vi.fn()}
        range={range}
        snapActive={false}
      />
    );
  }

  if (kind === "playhead") {
    return (
      <Playhead
        dragging={dragging}
        maximum={range.sourceDurationMicros}
        onKeyDown={vi.fn()}
        onLostPointerCapture={vi.fn()}
        onPointerCancel={vi.fn()}
        onPointerDown={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerUp={vi.fn()}
        percent={50}
        playheadRef={{ current: null }}
        value={5_000_000}
      />
    );
  }

  const boundary = kind === "trim-start" ? "start" : "end";
  return (
    <TrimHandle
      boundary={boundary}
      dragging={dragging}
      maximum={range.sourceDurationMicros}
      minimum={0}
      onDoubleClick={vi.fn()}
      onKeyDown={vi.fn()}
      onPointerDown={vi.fn()}
      onPointerEnd={vi.fn()}
      onPointerMove={vi.fn()}
      snapActive={false}
      value={boundary === "start" ? range.startMicros : range.endMicros}
    />
  );
}

describe("TimelineHandles", () => {
  it.each([
    ["trim-start", "Trim start"],
    ["trim-end", "Trim end"],
    ["segment", "Move selected segment"],
    ["playhead", "Playback position"],
  ] as const)("does not show a tooltip for the %s handle", async (kind, accessibleName) => {
    const user = userEvent.setup();
    render(<TimelineHandle dragging={false} kind={kind} />);
    const handle = screen.getByRole("slider", { name: accessibleName });

    expect(handle).toHaveClass("select-none");
    await user.hover(handle);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
