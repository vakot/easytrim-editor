import { DragDropProvider, useDraggable } from "@dnd-kit/react";
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
  useDraggable: vi.fn(() => ({
    handleRef: () => undefined,
    isDragging: false,
    ref: () => undefined,
  })),
}));

describe("AppLayoutSidebar", () => {
  it("renders a draggable single-view sidebar without a sortable panel group", () => {
    const hosts = createSidebarViewHosts();

    render(
      <DragDropProvider>
        <AppLayoutSidebar
          draggingViewId={null}
          hosts={hosts}
          placement={null}
          side="left"
          views={["sources"]}
        />
      </DragDropProvider>,
    );

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    expect(sidebar.querySelector('[data-sidebar-view="sources"]')).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drag Imported Sources to move it between sidebars" }),
    ).toBeInTheDocument();
    expect(sidebar.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();

    const draggable = vi.mocked(useDraggable).mock.calls.at(-1)?.[0];
    expect(draggable).toMatchObject({
      id: "sources",
      type: "sidebar-view",
    });
    expect(draggable?.sensors).toHaveLength(2);
    expect(draggable?.sensors?.[0]).toMatchObject({
      options: { activationConstraints: [{ options: { value: 6 } }] },
    });
  });

  it("keeps the empty sidebar detection area invisible and shows a boundary line only when active", () => {
    const { unmount } = render(
      <DragDropProvider>
        <div className="relative" data-testid="workspace">
          <SidebarEmptyDropTarget isActive={false} isDragging side="right" />
        </div>
      </DragDropProvider>,
    );

    const target = document.querySelector<HTMLElement>('[data-sidebar-empty-drop-target="right"]');
    expect(target).toHaveClass("pointer-events-none", "w-[50vw]", "right-0");
    expect(target).not.toHaveClass("border-2", "bg-background/10", "shadow-xl");
    expect(target?.querySelector("[data-sidebar-empty-drop-indicator]")).toBeNull();

    unmount();
    const { unmount: unmountRight } = render(
      <DragDropProvider>
        <div className="relative" data-testid="workspace">
          <SidebarEmptyDropTarget isActive isDragging side="right" />
        </div>
      </DragDropProvider>,
    );

    const workspace = screen.getByTestId("workspace");
    const indicator = document.querySelector('[data-sidebar-empty-drop-indicator="right"]');
    expect(indicator).toHaveClass(
      "pointer-events-none",
      "absolute",
      "inset-y-0",
      "w-1",
      "bg-primary",
      "right-0",
    );
    expect(indicator?.parentElement).toBe(workspace);
    expect(indicator).not.toHaveClass("left-82", "right-82");

    unmountRight();
    render(
      <DragDropProvider>
        <div className="relative" data-testid="workspace">
          <SidebarEmptyDropTarget isActive isDragging side="left" />
        </div>
      </DragDropProvider>,
    );

    const leftTarget = document.querySelector<HTMLElement>(
      '[data-sidebar-empty-drop-target="left"]',
    );

    const leftIndicator = document.querySelector('[data-sidebar-empty-drop-indicator="left"]');

    expect(leftTarget).toHaveClass("pointer-events-none", "w-[50vw]", "left-0");
    expect(leftIndicator).toHaveClass("w-1", "bg-primary", "left-0");
    expect(leftIndicator?.parentElement).toBe(screen.getByTestId("workspace"));
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
