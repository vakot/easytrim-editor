import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const panelMock = vi.hoisted(() => {
  const model = { currentSize: 400, collapsed: false };
  const panel = {
    collapse: vi.fn(() => {
      model.collapsed = true;
    }),
    expand: vi.fn(() => {
      model.collapsed = false;
    }),
    getSize: vi.fn(() => ({ inPixels: model.currentSize })),
    isCollapsed: vi.fn(() => model.collapsed),
    resize: vi.fn((size: number) => {
      model.currentSize = size;
    }),
  };
  return { model, panel, ref: { current: panel } };
});

vi.mock("react-resizable-panels", () => ({
  usePanelRef: () => panelMock.ref,
}));

import { timelinePanelTargetSize, useTimelinePanelSizing } from "../useTimelinePanelSizing";

const constraints = {
  minSize: 180,
  defaultSize: 276,
  maxSize: 620,
};

beforeEach(() => {
  panelMock.model.currentSize = 400;
  panelMock.model.collapsed = false;
  vi.clearAllMocks();
});

describe("timelinePanelTargetSize", () => {
  it("preserves the current size when the source accepts it", () => {
    expect(timelinePanelTargetSize(400, constraints)).toBe(400);
  });

  it("clamps the preserved size to the next source bounds", () => {
    expect(timelinePanelTargetSize(100, constraints)).toBe(180);
    expect(timelinePanelTargetSize(900, constraints)).toBe(620);
  });
});

describe("useTimelinePanelSizing", () => {
  it("uses the fixed timeline-only size for the initial empty state", () => {
    const { result } = renderHook(() => useTimelinePanelSizing(null, null, true));

    expect(result.current.constraints).toEqual({ minSize: 170, defaultSize: 170, maxSize: 170 });
    expect(result.current.initialDefaultSize).toBe(170);
    expect(panelMock.panel.resize).toHaveBeenCalledOnce();
    expect(panelMock.panel.resize).toHaveBeenCalledWith(170);
  });

  it("resets an explicitly cleared source and preserves that valid size for the next source", () => {
    const { rerender } = renderHook(
      ({ sourceId, audioTrackCount }) => useTimelinePanelSizing(sourceId, audioTrackCount, true),
      {
        initialProps: {
          sourceId: "source-1" as string | null,
          audioTrackCount: 3 as number | null,
        },
      },
    );
    panelMock.model.currentSize = 400;
    panelMock.panel.resize.mockClear();

    rerender({ sourceId: null, audioTrackCount: null });
    expect(panelMock.panel.resize).toHaveBeenCalledOnce();
    expect(panelMock.panel.resize).toHaveBeenLastCalledWith(170);

    panelMock.panel.resize.mockClear();
    rerender({ sourceId: "source-2", audioTrackCount: null });
    rerender({ sourceId: "source-2", audioTrackCount: 1 });

    expect(panelMock.panel.resize).not.toHaveBeenCalled();
    expect(panelMock.model.currentSize).toBe(170);
  });

  it("keeps an explicitly cleared timeline collapsed", () => {
    const { rerender, result } = renderHook(
      ({ sourceId, audioTrackCount }) => useTimelinePanelSizing(sourceId, audioTrackCount, false),
      {
        initialProps: {
          sourceId: "source-1" as string | null,
          audioTrackCount: 3 as number | null,
        },
      },
    );
    panelMock.panel.resize.mockClear();

    rerender({ sourceId: null, audioTrackCount: null });

    expect(result.current.constraints).toEqual({ minSize: 170, defaultSize: 170, maxSize: 170 });
    expect(panelMock.panel.resize).not.toHaveBeenCalled();
  });

  it("preserves the user size with permissive bounds while replacement metadata is pending", () => {
    const { rerender, result } = renderHook(
      ({ sourceId, audioTrackCount }) => useTimelinePanelSizing(sourceId, audioTrackCount, true),
      { initialProps: { sourceId: "source-1", audioTrackCount: 3 as number | null } },
    );
    panelMock.model.currentSize = 400;
    panelMock.panel.resize.mockClear();

    rerender({ sourceId: "source-2", audioTrackCount: null });
    expect(result.current.constraints).toEqual({
      minSize: 170,
      defaultSize: 170,
      maxSize: "100%",
    });
    expect(panelMock.panel.resize).not.toHaveBeenCalled();

    rerender({ sourceId: "source-2", audioTrackCount: 3 });
    expect(panelMock.panel.resize).not.toHaveBeenCalled();
    expect(panelMock.model.currentSize).toBe(400);
  });

  it("preserves a valid restored size when a loaded source mounts", () => {
    renderHook(() => useTimelinePanelSizing("source-2", 3, true));

    expect(panelMock.panel.resize).not.toHaveBeenCalled();
    expect(panelMock.model.currentSize).toBe(400);
  });

  it("clamps an oversized restored size when a loaded source mounts", () => {
    panelMock.model.currentSize = 900;

    renderHook(() => useTimelinePanelSizing("source-2", 1, true));

    expect(panelMock.panel.resize).toHaveBeenCalledOnce();
    expect(panelMock.panel.resize).toHaveBeenCalledWith(319);
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
