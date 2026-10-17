import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDragAwareDoubleClick } from "../useDragAwareDoubleClick";

function DragAwareDoubleClickHarness({
  onDoubleClick,
}: {
  onDoubleClick: (
    event: React.MouseEvent<HTMLDivElement>,
    pointerDownTarget: EventTarget | null,
  ) => void;
}) {
  const handlers = useDragAwareDoubleClick<HTMLDivElement>(onDoubleClick);

  return (
    <div data-testid="track" {...handlers}>
      <button data-testid="trim-handle" type="button">
        Trim
      </button>
    </div>
  );
}

describe("useDragAwareDoubleClick", () => {
  it("preserves the pointer-down target when pointer capture retargets the double-click", () => {
    const onDoubleClick = vi.fn();
    render(<DragAwareDoubleClickHarness onDoubleClick={onDoubleClick} />);

    const track = screen.getByTestId("track");
    const trimHandle = screen.getByTestId("trim-handle");
    fireEvent.pointerDown(trimHandle, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(track, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.doubleClick(track);

    expect(onDoubleClick).toHaveBeenCalledOnce();
    expect(onDoubleClick.mock.calls[0]?.[0].target).toBe(track);
    expect(onDoubleClick.mock.calls[0]?.[1]).toBe(trimHandle);
  });
});
