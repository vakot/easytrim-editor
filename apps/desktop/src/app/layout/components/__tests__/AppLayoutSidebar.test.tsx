import { DragDropProvider } from "@dnd-kit/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";

import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";

import { AppLayoutSidebar, SidebarEmptyDropTarget } from "../AppLayoutSidebar";
import { SidebarViewTarget } from "../SidebarViewPortal";

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDroppable: () => ({ isDropTarget: false, ref: () => undefined }),
}));

vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: () => ({ handleRef: () => undefined, isDragging: false, ref: () => undefined }),
}));

describe("AppLayoutSidebar", () => {
  it("renders a sortable single-view sidebar", () => {
    const hosts = createSidebarViewHosts();

    render(
      <DragDropProvider>
        <AppLayoutSidebar hosts={hosts} side="left" views={["sources"]} />
      </DragDropProvider>,
    );

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    expect(sidebar.querySelector('[data-sidebar-view="sources"]')).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drag Imported Sources to move it between sidebars" }),
    ).toBeInTheDocument();
    expect(sidebar.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();
  });

  it("registers an empty sidebar drop target while a view is dragged", () => {
    render(
      <DragDropProvider>
        <SidebarEmptyDropTarget isDragging side="right" />
      </DragDropProvider>,
    );

    expect(screen.getByRole("region", { name: "Right sidebar" })).toBeVisible();
  });
});

function StatefulView({ onMount }: { onMount: () => void }) {
  const [value, setValue] = useState("preserved");
  useEffect(onMount, [onMount]);
  return (
    <input
      aria-label="View state"
      onChange={(event) => setValue(event.target.value)}
      value={value}
    />
  );
}

function StatefulPortalHarness({ onMount }: { onMount: () => void }) {
  const [host] = useState(() => document.createElement("div"));
  const [side, setSide] = useState<"left" | "right">("left");

  return (
    <>
      <button onClick={() => setSide(side === "left" ? "right" : "left")}>Move view</button>
      <aside>{side === "left" ? <SidebarViewTarget host={host} /> : null}</aside>
      <aside>{side === "right" ? <SidebarViewTarget host={host} /> : null}</aside>
      {createPortal(<StatefulView onMount={onMount} />, host)}
    </>
  );
}

describe("SidebarViewTarget", () => {
  it("moves a view host without remounting its React subtree", () => {
    const onMount = vi.fn();

    render(
      <ResizablePanelContextProvider>
        <StatefulPortalHarness onMount={onMount} />
      </ResizablePanelContextProvider>,
    );

    const input = screen.getByRole("textbox", { name: "View state" });
    fireEvent.change(input, { target: { value: "edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Move view" }));

    expect(screen.getByRole("textbox", { name: "View state" })).toHaveValue("edited");
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
