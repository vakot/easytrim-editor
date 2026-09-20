import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

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
        snapPoint={null}
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

function withTooltipProvider(kind: HandleKind, dragging: boolean) {
  return (
    <TooltipProvider delayDuration={0}>
      <TimelineHandle dragging={dragging} kind={kind} />
    </TooltipProvider>
  );
}

describe("TimelineHandles", () => {
  it.each([
    ["trim-start", "Trim start"],
    ["trim-end", "Trim end"],
    ["segment", "Move selected segment"],
    ["playhead", "Playback position"],
  ] as const)("hides the %s tooltip while dragging", async (kind, accessibleName) => {
    const user = userEvent.setup();
    const view = render(withTooltipProvider(kind, false));
    const handle = screen.getByRole("slider", { name: accessibleName });

    await user.hover(handle);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();

    view.rerender(withTooltipProvider(kind, true));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    view.rerender(withTooltipProvider(kind, false));
    await user.unhover(handle);
    await user.hover(handle);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });
});
