import { act, fireEvent, render, screen } from "@testing-library/react";
import { type PropsWithChildren, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelControl,
  ResizablePanelGroup,
  usePanelCommand,
  usePanelState,
} from "../resizable";

const STORAGE_KEY = "react-resizable-panels:workspace:workspace-left-sidebar:workspace-content";
const SIDEBAR_STORAGE_KEY =
  "react-resizable-panels:editor-source:editor-source-imported-sources:editor-source-activity-feed";

const frames = new Map<number, FrameRequestCallback>();
const observers = new Map<
  ResizeObserver,
  { callback: ResizeObserverCallback; targets: Element[] }
>();

function flushFrame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(performance.now()));
  });
}

function flushPanelResizes() {
  act(() => {
    observers.forEach(({ callback, targets }, observer) => {
      const entries = targets.map((target): ResizeObserverEntry => {
        const size = [{ blockSize: 800, inlineSize: (target as HTMLElement).offsetWidth || 1600 }];
        return {
          borderBoxSize: size,
          contentBoxSize: size,
          contentRect: target.getBoundingClientRect(),
          devicePixelContentBoxSize: size,
          target,
        };
      });

      callback(entries, observer);
    });
  });
}

function Controls() {
  const command = usePanelCommand("workspace-left-sidebar");
  const panel = usePanelState("workspace-left-sidebar");
  return (
    <>
      <button aria-pressed={command.isCollapsed} onClick={command.toggle}>
        Toggle sidebar command
      </button>
      <ResizablePanelControl panelId="workspace-left-sidebar">
        <button>Toggle sidebar control</button>
      </ResizablePanelControl>
      <button onClick={() => panel.ref.current?.collapse()}>Temporarily collapse sidebar</button>
      <button onClick={() => panel.ref.current?.expand()}>Temporarily expand sidebar</button>
      <button onClick={() => panel.runUserInteraction(() => panel.ref.current?.expand())}>
        Keep sidebar expanded
      </button>
    </>
  );
}

function Workspace() {
  return (
    <StrictMode>
      <ResizablePanelContextProvider>
        <ResizablePanelGroup
          className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200"
          id="workspace"
          onlySaveAfterUserInteractions
          persisted
        >
          <ResizablePanel
            collapsedSize={0}
            collapsible
            defaultSize="360px"
            id="workspace-left-sidebar"
            maxSize="32rem"
            minSize="20.5rem"
          >
            Sidebar
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="workspace-content" minSize="50rem">
            Content
          </ResizablePanel>
        </ResizablePanelGroup>
        <Controls />
      </ResizablePanelContextProvider>
    </StrictMode>
  );
}

function SidebarPanels() {
  return (
    <StrictMode>
      <ResizablePanelContextProvider>
        <ResizablePanelGroup
          id="editor-source"
          orientation="vertical"
          panelIds={["editor-source-imported-sources", "editor-source-activity-feed"]}
          persisted
        >
          <SidebarPanel defaultSize="45" id="editor-source-imported-sources" minSize="18.75rem">
            Imported Sources
          </SidebarPanel>
          <ResizableHandle />
          <SidebarPanel defaultSize="30" id="editor-source-activity-feed" minSize="12.5rem">
            Activity Feed
          </SidebarPanel>
        </ResizablePanelGroup>
        <ResizablePanelControl panelId="editor-source-activity-feed">
          <button>Toggle Activity Feed</button>
        </ResizablePanelControl>
      </ResizablePanelContextProvider>
    </StrictMode>
  );
}

function SidebarPanel({
  children,
  defaultSize,
  id,
  minSize,
}: PropsWithChildren<{ defaultSize: string; id: string; minSize: string }>) {
  return (
    <ResizablePanel
      collapsedSize="2.5rem"
      collapsible
      defaultSize={defaultSize}
      id={id}
      minSize={minSize}
    >
      {children}
    </ResizablePanel>
  );
}

beforeEach(() => {
  localStorage.clear();
  frames.clear();
  observers.clear();
  let frameId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  document.documentElement.style.fontSize = "16px";
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.hasAttribute("data-panel") || this.parentElement?.id !== "workspace") return 0;
    const sidebar = document.getElementById("workspace-left-sidebar");
    const percentage = Number.parseFloat(sidebar?.style.flexGrow ?? "");
    const sidebarWidth = Number.isFinite(percentage) ? percentage * 16 : 360;
    return this.id === "workspace-left-sidebar" ? sidebarWidth : 1600 - sidebarWidth;
  });
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.id === "workspace-content"
      ? (document.getElementById("workspace-left-sidebar")?.offsetWidth ?? 0)
      : 0;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observers.set(this, { callback, targets: [] });
      }
      disconnect() {
        observers.delete(this);
      }
      observe(target: Element) {
        observers.get(this)?.targets.push(target);
      }
      unobserve() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("persisted resizable workspace", () => {
  it("restores collapsed state at zero and persists command/control toggles across remounts", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "workspace-left-sidebar": 0, "workspace-content": 100 }),
    );
    let view = render(<Workspace />);
    await act(async () => {});
    const group = document.getElementById("workspace")!;
    expect(document.getElementById("workspace-left-sidebar")).toHaveStyle({ flexGrow: "0" });
    expect(screen.getByRole("button", { name: "Toggle sidebar command" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(group).toHaveAttribute("data-initializing");
    flushFrame();
    expect(group).toHaveAttribute("data-initializing");
    flushFrame();
    expect(group).not.toHaveAttribute("data-initializing");

    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar command" }));
    flushPanelResizes();
    const expandedLayout = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(expandedLayout["workspace-left-sidebar"]).toBeGreaterThan(0);
    expect(group).not.toHaveAttribute("data-initializing");
    expect(group.className).toContain("duration-200");

    view.unmount();
    view = render(<Workspace />);
    await act(async () => {});
    expect(document.getElementById("workspace-left-sidebar")).toHaveStyle({
      flexGrow: String(expandedLayout["workspace-left-sidebar"]),
    });
    expect(screen.getByRole("button", { name: "Toggle sidebar command" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    flushFrame();
    flushFrame();
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar control" }));
    flushPanelResizes();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)["workspace-left-sidebar"]).toBe(0);

    view.unmount();
    render(<Workspace />);
    await act(async () => {});
    expect(document.getElementById("workspace-left-sidebar")).toHaveStyle({ flexGrow: "0" });
    expect(screen.getByRole("button", { name: "Toggle sidebar command" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("preserves the saved width and ignores temporary expansion/collapse", () => {
    const savedLayout = { "workspace-left-sidebar": 30, "workspace-content": 70 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLayout));
    const view = render(<Workspace />);
    expect(document.getElementById("workspace-left-sidebar")?.offsetWidth).toBe(480);
    fireEvent.click(screen.getByRole("button", { name: "Temporarily collapse sidebar" }));
    flushPanelResizes();
    expect(document.getElementById("workspace-left-sidebar")?.offsetWidth).toBe(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(savedLayout);
    fireEvent.click(screen.getByRole("button", { name: "Temporarily expand sidebar" }));
    flushPanelResizes();
    expect(document.getElementById("workspace-left-sidebar")?.offsetWidth).toBe(480);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(savedLayout);
    view.unmount();
    render(<Workspace />);
    expect(document.getElementById("workspace-left-sidebar")?.offsetWidth).toBe(480);
  });

  it("can commit a temporary expansion without requiring another size change", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "workspace-left-sidebar": 0, "workspace-content": 100 }),
    );
    const view = render(<Workspace />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Temporarily expand sidebar" }));
    flushPanelResizes();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)["workspace-left-sidebar"]).toBe(0);
    const expandedWidth = document.getElementById("workspace-left-sidebar")?.offsetWidth;
    fireEvent.click(screen.getByRole("button", { name: "Keep sidebar expanded" }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!)["workspace-left-sidebar"],
    ).toBeGreaterThan(0);
    expect(document.getElementById("workspace-left-sidebar")?.offsetWidth).toBe(expandedWidth);
    view.unmount();
    render(<Workspace />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Toggle sidebar command" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(document.getElementById("workspace-left-sidebar")?.offsetWidth).toBe(expandedWidth);
  });

  it("restores collapsed sidebar views after remount without changing their collapsed size", async () => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify({
        "editor-source-imported-sources": 70,
        "editor-source-activity-feed": 30,
      }),
    );
    const view = render(<SidebarPanels />);
    await act(async () => {});
    flushPanelResizes();
    flushFrame();
    flushFrame();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Activity Feed" }));
    flushPanelResizes();
    const savedLayout = JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY)!);
    expect(savedLayout["editor-source-activity-feed"]).toBeLessThan(
      savedLayout["editor-source-imported-sources"],
    );

    view.unmount();
    render(<SidebarPanels />);
    await act(async () => {});

    expect(JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY)!)).toEqual(savedLayout);
    expect(document.getElementById("editor-source-activity-feed")).toHaveStyle({
      flexGrow: String(savedLayout["editor-source-activity-feed"]),
    });
    expect(document.getElementById("editor-source")).toHaveAttribute("data-initializing");
    flushFrame();
    flushFrame();
    expect(document.getElementById("editor-source")).not.toHaveAttribute("data-initializing");
  });
});
