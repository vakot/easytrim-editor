import { describe, expect, it } from "vitest";

import type { SidebarLayout } from "../sidebar-layout";
import { getDockViewGroups, getSidebarViewSide, WORKSPACE_VIEWS } from "../workspace-view-registry";

describe("workspace view registry", () => {
  it("lists the source, activity, and export queue views for open and dock menus", () => {
    expect(WORKSPACE_VIEWS.map(({ id }) => id)).toEqual(["sources", "activity", "exportQueue"]);
  });

  it("groups docked views by side and leaves only undocked views available", () => {
    const layout: SidebarLayout = { left: ["sources"], right: ["exportQueue"] };

    expect(getDockViewGroups(layout)).toEqual([
      { id: "left", views: ["sources"] },
      { id: "right", views: ["exportQueue"] },
      { id: "available", views: ["activity"] },
    ]);
    expect(getSidebarViewSide(layout, "sources")).toBe("left");
    expect(getSidebarViewSide(layout, "activity")).toBeNull();
  });
});
