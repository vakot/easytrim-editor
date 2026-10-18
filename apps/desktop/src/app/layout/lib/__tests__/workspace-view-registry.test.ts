import { describe, expect, it } from "vitest";

import type { SidebarLayout } from "../sidebar-layout";
import { getSidebarViewSide, WORKSPACE_VIEWS } from "../workspace-view-registry";

describe("workspace view registry", () => {
  it("lists the source, activity, history, and export queue views for open and dock menus", () => {
    expect(WORKSPACE_VIEWS.map(({ id }) => id)).toEqual([
      "sources",
      "activity",
      "history",
      "exportQueue",
    ]);
  });

  it("reports the sidebar containing a view", () => {
    const layout: SidebarLayout = { left: ["sources"], right: ["exportQueue"] };

    expect(getSidebarViewSide(layout, "sources")).toBe("left");
    expect(getSidebarViewSide(layout, "activity")).toBeNull();
  });
});
