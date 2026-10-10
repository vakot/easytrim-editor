import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";

import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";

import { AppLayoutSidebar, SidebarEmptyDropTarget } from "../AppLayoutSidebar";
import { SidebarViewTarget } from "../SidebarViewPortal";

const DRAG_TYPE = "application/x-easytrim-sidebar-view";

function createDataTransfer(viewId: string): DataTransfer {
  return {
    dropEffect: "none",
    effectAllowed: "all",
    getData: (format: string) => (format === DRAG_TYPE ? viewId : ""),
    setData: vi.fn(),
  } as unknown as DataTransfer;
}

describe("AppLayoutSidebar", () => {
  it("previews and commits the same insertion point for a single-view sidebar", () => {
    const hosts = createSidebarViewHosts();
    const onDrop = vi.fn();
    const onPreview = vi.fn();
    const dataTransfer = createDataTransfer("activity");

    render(
      <AppLayoutSidebar
        draggedViewId="activity"
        dropPreview={null}
        hosts={hosts}
        onDragEnd={vi.fn()}
        onDragStart={vi.fn()}
        onDrop={onDrop}
        onPreview={onPreview}
        side="left"
        views={["sources"]}
      />,
    );

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    const item = sidebar.querySelector<HTMLElement>('[data-sidebar-view="sources"]');
    expect(item).not.toBeNull();
    vi.spyOn(sidebar, "getBoundingClientRect").mockReturnValue({ top: 10 } as DOMRect);
    vi.spyOn(item!, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 140,
      height: 100,
    } as DOMRect);

    fireEvent.dragOver(sidebar, { clientY: 20, dataTransfer });
    fireEvent.drop(sidebar, { clientY: 20, dataTransfer });

    expect(onPreview).toHaveBeenCalledWith({ index: 1, offset: 130, side: "left" });
    expect(onDrop).toHaveBeenCalledWith("activity", "left", 1);
    expect(sidebar.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();
  });

  it("previews and accepts a view in an empty sidebar", () => {
    const onDrop = vi.fn();
    const dataTransfer = createDataTransfer("activity");

    function EmptySidebarHarness() {
      const [preview, setPreview] = useState<{
        index: number;
        offset: number;
        side: "left" | "right";
      } | null>(null);

      return (
        <>
          <SidebarEmptyDropTarget
            onDrop={onDrop}
            onPreview={setPreview}
            preview={preview}
            side="right"
          />
          <output>{preview ? `${preview.side}:${preview.index}` : "none"}</output>
        </>
      );
    }

    render(<EmptySidebarHarness />);
    const target = screen.getByRole("region", { name: "Right sidebar" });

    fireEvent.dragOver(target, { dataTransfer });
    expect(screen.getByText("right:0")).toBeInTheDocument();

    fireEvent.drop(target, { dataTransfer });
    expect(onDrop).toHaveBeenCalledWith("activity", "right", 0);
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
