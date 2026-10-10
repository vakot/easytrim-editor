import { DragDropProvider, useDraggable } from "@dnd-kit/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";

import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";

import { AppLayoutSidebar, SidebarEmptyDropTarget } from "../AppLayoutSidebar";
import { SidebarViewTarget } from "../SidebarViewPortal";

const dragMocks = vi.hoisted(() => ({ handles: new Map<string, Element>() }));

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDroppable: () => ({ isDropTarget: false, ref: () => undefined }),
  useDraggable: vi.fn(({ id }: { id: string }) => ({
    handleRef: (element: Element | null) => {
      if (element) dragMocks.handles.set(id, element);
      else dragMocks.handles.delete(id);
    },
    isDragging: false,
    ref: () => undefined,
  })),
}));

vi.mock("@/components/ui/resizable", async (importOriginal) => {
  const React = await import("react");
  const actual = await importOriginal<typeof import("@/components/ui/resizable")>();

  return {
    ...actual,
    ResizablePanelControl: ({
      children,
    }: {
      children: (state: {
        isAvailable: boolean;
        isCollapsed: boolean;
        isDisabled: boolean;
        isExpanded: boolean;
        isMixed: boolean;
      }) => React.ReactNode;
    }) => {
      const [isExpanded, setIsExpanded] = React.useState(true);
      return (
        <div onClick={() => setIsExpanded((expanded) => !expanded)}>
          {children({
            isAvailable: true,
            isCollapsed: !isExpanded,
            isDisabled: false,
            isExpanded,
            isMixed: false,
          })}
        </div>
      );
    },
  };
});

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
    const header = screen.getByRole("button", {
      name: "Drag Imported Sources, or press D then use the arrow keys to move it; D to drop or Escape to cancel",
    });

    expect(header).toBeInTheDocument();

    expect(header).not.toHaveAttribute("aria-expanded");
    expect(dragMocks.handles.get("sources")).toBe(header);
    expect(header.querySelector("svg")).toBeInTheDocument();
    expect(sidebar.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();

    const draggable = vi.mocked(useDraggable).mock.calls.at(-1)?.[0];
    expect(draggable).toMatchObject({
      id: "sources",
      type: "sidebar-view",
    });
    expect(draggable?.sensors).toHaveLength(1);
    expect(draggable?.sensors?.[0]).toMatchObject({
      options: { activationConstraints: [{ options: { value: 6 } }] },
    });
  });

  it("toggles a multi-panel header on click while keeping drag clicks separate", async () => {
    const user = userEvent.setup();
    const hosts = createSidebarViewHosts();

    render(
      <DragDropProvider>
        <ResizablePanelContextProvider>
          <AppLayoutSidebar
            draggingViewId={null}
            hosts={hosts}
            placement={null}
            side="left"
            views={["sources", "activity"]}
          />
        </ResizablePanelContextProvider>
      </DragDropProvider>,
    );

    const header = await screen.findByRole("button", {
      name: "Collapse Imported Sources; drag or press D then use the arrow keys to move it; D to drop or Escape to cancel",
    });

    expect(dragMocks.handles.get("sources")).toBe(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(header).toHaveAttribute("aria-controls", "editor-source-imported-sources");

    await user.click(header);
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "false"));

    // A sub-threshold pointer movement leaves the interaction as a regular click.
    fireEvent.pointerDown(header, {
      button: 0,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerMove(header, { clientX: 103, clientY: 104, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 103, clientY: 104, pointerId: 1 });
    fireEvent.click(header);
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "true"));

    // Crossing the pointer sensor threshold starts a drag and must not toggle the panel.
    fireEvent.pointerDown(header, {
      button: 0,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 2,
    });
    fireEvent.pointerMove(header, { clientX: 106, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(header, { clientX: 106, clientY: 100, pointerId: 2 });
    // Some browsers suppress click after a completed drag. Keyboard toggle
    // must still work in that case.
    header.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "false"));

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");

    // Native Enter and Space activations continue to use the panel control.
    header.focus();
    fireEvent.keyDown(header, { key: " " });
    fireEvent.keyUp(header, { key: " " });
    // jsdom does not synthesize the native button click for Space.
    fireEvent.click(header, { detail: 0 });
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "false"));
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
      "rounded",
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
    expect(leftIndicator).toHaveClass("w-1", "rounded", "bg-primary", "left-0");
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
