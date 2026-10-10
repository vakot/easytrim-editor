import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIDEBAR_LAYOUT,
  moveSidebarView,
  normalizeSidebarLayout,
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
});
