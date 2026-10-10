import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIDEBAR_LAYOUT,
  moveSidebarView,
  normalizeSidebarLayout,
  resolveSidebarDropPlacement,
  resolveSidebarInsertionIndex,
  type SidebarLayout,
} from "../sidebar-layout";

describe("sidebar layout", () => {
  it("uses the default layout when persisted data has the wrong shape", () => {
    expect(normalizeSidebarLayout(null)).toEqual(DEFAULT_SIDEBAR_LAYOUT);
    expect(normalizeSidebarLayout({ left: ["activity"] })).toEqual(DEFAULT_SIDEBAR_LAYOUT);
  });

  it("removes unknown and duplicate views and restores missing supported views", () => {
    expect(
      normalizeSidebarLayout({
        left: ["activity", "unknown", "activity"],
        right: ["sources", "missing"],
      }),
    ).toEqual({ left: ["activity"], right: ["sources"] });

    expect(normalizeSidebarLayout({ left: [], right: [] })).toEqual(DEFAULT_SIDEBAR_LAYOUT);
  });

  it("moves a view across sidebars at the requested insertion point", () => {
    expect(moveSidebarView(DEFAULT_SIDEBAR_LAYOUT, "activity", "right", 0)).toEqual({
      left: ["sources"],
      right: ["activity"],
    });
  });

  it("supports leaving one sidebar empty", () => {
    expect(
      moveSidebarView({ left: ["sources"], right: ["activity"] }, "sources", "right", 0),
    ).toEqual({ left: [], right: ["sources", "activity"] });
  });

  it("reorders a view and clamps the insertion index", () => {
    expect(moveSidebarView(DEFAULT_SIDEBAR_LAYOUT, "sources", "left", 2)).toEqual({
      left: ["activity", "sources"],
      right: [],
    });
    expect(moveSidebarView(DEFAULT_SIDEBAR_LAYOUT, "activity", "right", 9)).toEqual({
      left: ["sources"],
      right: ["activity"],
    });
  });

  it("keeps the layout reference when a drop does not change placement", () => {
    const layout: SidebarLayout = { left: ["sources", "activity"], right: [] };

    expect(moveSidebarView(layout, "sources", "left", 0)).toBe(layout);
  });

  it("moves the first panel below the second using the resolved slot", () => {
    const layout: SidebarLayout = { left: ["sources", "activity"], right: [] };
    const placement = resolveSidebarDropPlacement(layout, "sources", "left", 80, [
      { bottom: 100, top: 0, viewId: "activity" },
    ]);

    expect(placement).toMatchObject({ destination: "left", insertionIndex: 1, viewId: "sources" });
    expect(
      moveSidebarView(layout, "sources", placement!.destination, placement!.insertionIndex),
    ).toEqual({
      left: ["activity", "sources"],
      right: [],
    });
  });

  it("moves the second panel above the first using the resolved slot", () => {
    const layout: SidebarLayout = { left: ["sources", "activity"], right: [] };
    const placement = resolveSidebarDropPlacement(layout, "activity", "left", 20, [
      { bottom: 100, top: 0, viewId: "sources" },
    ]);

    expect(placement).toMatchObject({ destination: "left", insertionIndex: 0, viewId: "activity" });
    expect(
      moveSidebarView(layout, "activity", placement!.destination, placement!.insertionIndex),
    ).toEqual({
      left: ["activity", "sources"],
      right: [],
    });
  });

  it("treats dragging the last panel below itself as a no-op", () => {
    const layout: SidebarLayout = { left: ["sources", "activity"], right: [] };

    expect(
      resolveSidebarDropPlacement(layout, "activity", "left", 120, [
        { bottom: 100, top: 0, viewId: "sources" },
      ]),
    ).toBeNull();
    expect(moveSidebarView(layout, "activity", "left", 1)).toBe(layout);
  });

  it("treats dragging the first panel immediately above itself as a no-op", () => {
    const layout: SidebarLayout = { left: ["sources", "activity"], right: [] };

    expect(
      resolveSidebarDropPlacement(layout, "sources", "left", -10, [
        { bottom: 100, top: 0, viewId: "activity" },
      ]),
    ).toBeNull();
    expect(moveSidebarView(layout, "sources", "left", 0)).toBe(layout);
  });

  it("resolves beginning, middle, and end insertion slots from one ordered geometry", () => {
    const bounds = [0, 1, 2].map((index) => ({
      bottom: (index + 1) * 100,
      top: index * 100,
      viewId: index === 0 ? "sources" : "activity",
    }));

    expect(resolveSidebarInsertionIndex(-1, bounds)).toBe(0);
    expect(resolveSidebarInsertionIndex(149, bounds)).toBe(1);
    expect(resolveSidebarInsertionIndex(400, bounds)).toBe(3);
  });

  it("places a moved view at the expected index in the other populated sidebar", () => {
    const layout: SidebarLayout = { left: ["sources"], right: ["activity"] };
    const placement = resolveSidebarDropPlacement(layout, "sources", "right", 20, [
      { bottom: 100, top: 0, viewId: "activity" },
    ]);

    expect(placement).toMatchObject({ destination: "right", insertionIndex: 0, viewId: "sources" });
    expect(
      moveSidebarView(layout, "sources", placement!.destination, placement!.insertionIndex),
    ).toEqual({
      left: [],
      right: ["sources", "activity"],
    });
  });

  it("does not create duplicate view IDs after drag placements", () => {
    const layouts = [
      moveSidebarView(DEFAULT_SIDEBAR_LAYOUT, "sources", "left", 1),
      moveSidebarView(DEFAULT_SIDEBAR_LAYOUT, "activity", "right", 0),
      moveSidebarView({ left: ["sources"], right: ["activity"] }, "sources", "right", 1),
    ];

    for (const layout of layouts) {
      const viewIds = [...layout.left, ...layout.right];
      expect(new Set(viewIds).size).toBe(viewIds.length);
    }
  });
});
