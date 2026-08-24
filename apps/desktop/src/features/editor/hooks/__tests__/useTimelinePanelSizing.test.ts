import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const panelMock = vi.hoisted(() => {
  const model = { currentSize: 400 };
  const panel = {
    collapse: vi.fn(),
    expand: vi.fn(),
    getSize: vi.fn(() => ({ inPixels: model.currentSize })),
    isCollapsed: vi.fn(() => false),
    resize: vi.fn((size: number) => {
      model.currentSize = size;
    }),
  };
  return { model, panel, ref: { current: panel } };
});

vi.mock("react-resizable-panels", () => ({
  usePanelRef: () => panelMock.ref,
}));

import {
  timelinePanelConstraintsForSource,
  timelinePanelTargetSize,
  useTimelinePanelSizing,
} from "../useTimelinePanelSizing";

const constraints = {
  minSize: 180,
  defaultSize: 276,
  maxSize: 620,
};

beforeEach(() => {
  panelMock.model.currentSize = 400;
  vi.clearAllMocks();
});

describe("timelinePanelTargetSize", () => {
  it("uses the measured one-track default for the first source", () => {
    expect(timelinePanelTargetSize(400, constraints, true)).toBe(276);
  });

  it("preserves the current size when the next source accepts it", () => {
    expect(timelinePanelTargetSize(400, constraints, false)).toBe(400);
  });

  it("clamps the preserved size to the next source bounds", () => {
    expect(timelinePanelTargetSize(100, constraints, false)).toBe(180);
    expect(timelinePanelTargetSize(900, constraints, false)).toBe(620);
  });

  it("retains confirmed bounds while replacement metadata is pending", () => {
    expect(timelinePanelConstraintsForSource(null, constraints)).toBe(constraints);
  });

  it("replaces retained bounds once the next source track count is known", () => {
    expect(timelinePanelConstraintsForSource(0, constraints)).toEqual({
      minSize: 170,
      defaultSize: 170,
      maxSize: 170,
    });
  });
});

describe("useTimelinePanelSizing", () => {
  it("preserves the user size while replacement metadata is pending", () => {
    const { rerender } = renderHook(
      ({ sourceId, audioTrackCount }) => useTimelinePanelSizing(sourceId, audioTrackCount, true),
      { initialProps: { sourceId: "source-1", audioTrackCount: 3 as number | null } },
    );
    panelMock.model.currentSize = 400;
    panelMock.panel.resize.mockClear();

    rerender({ sourceId: "source-2", audioTrackCount: null });
    expect(panelMock.panel.resize).not.toHaveBeenCalled();

    rerender({ sourceId: "source-2", audioTrackCount: 3 });
    expect(panelMock.panel.resize).not.toHaveBeenCalled();
    expect(panelMock.model.currentSize).toBe(400);
  });

  it("clamps the preserved size when the confirmed source allows less height", () => {
    const { rerender } = renderHook(
      ({ sourceId, audioTrackCount }) => useTimelinePanelSizing(sourceId, audioTrackCount, true),
      { initialProps: { sourceId: "source-1", audioTrackCount: 3 as number | null } },
    );
    panelMock.model.currentSize = 400;
    panelMock.panel.resize.mockClear();

    rerender({ sourceId: "source-2", audioTrackCount: null });
    rerender({ sourceId: "source-2", audioTrackCount: 1 });

    expect(panelMock.panel.resize).toHaveBeenCalledOnce();
    expect(panelMock.panel.resize).toHaveBeenCalledWith(319);
  });
});
