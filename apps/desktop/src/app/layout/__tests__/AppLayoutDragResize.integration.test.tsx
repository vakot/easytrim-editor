import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider, usePanelCommand } from "@/components/ui/resizable";

import { AppLayout } from "@/app/layout/AppLayout";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";

vi.mock("@/app/layout/components/AppLayoutHeader", async () => {
  const { useDragDropManager } = await import("@dnd-kit/react");

  function DragControls() {
    const manager = useDragDropManager();
    return (
      <header>
        <button
          onClick={() =>
            manager?.actions.start({ source: "sources", coordinates: { x: 100, y: 150 } })
          }
          type="button"
        >
          Begin Sources drag
        </button>
        <button
          onClick={() =>
            manager?.actions.start({ source: "activity", coordinates: { x: 100, y: 450 } })
          }
          type="button"
        >
          Begin Activity drag
        </button>
        <button onClick={() => manager?.actions.move({ to: { x: 100, y: 650 } })} type="button">
          Move drag below panels
        </button>
        <button onClick={() => manager?.actions.move({ to: { x: 100, y: 50 } })} type="button">
          Move drag above panels
        </button>
        <button onClick={() => manager?.actions.stop()} type="button">
          Finish drag
        </button>
        <button onClick={() => manager?.actions.stop({ canceled: true })} type="button">
          Cancel drag
        </button>
      </header>
    );
  }

  return { AppLayoutHeader: DragControls };
});

vi.mock("@/app/layout/components/AppLayoutFooter", () => ({
  AppLayoutFooter: () => <footer />,
}));

vi.mock("@/app/layout/components/AppLayoutMain", () => ({
  AppLayoutMain: () => <div>Editor content</div>,
}));

vi.mock("@/app/layout/components/AppLayoutPanel", () => ({
  AppLayoutPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/layout/components/SidebarViewPortal", () => ({
  createSidebarViewHosts: () => ({
    activity: document.createElement("div"),
    sources: document.createElement("div"),
  }),
  SidebarViewPortals: () => null,
  SidebarViewTarget: () => <div />,
}));

function setBounds(element: HTMLElement, top: number, bottom: number) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        bottom,
        height: bottom - top,
        left: 0,
        right: 400,
        top,
        width: 400,
        x: 0,
        y: top,
      }) as DOMRect,
  });
}

function PanelRegistrationProbe() {
  const panels = usePanelCommand(["editor-source-imported-sources", "editor-source-activity-feed"]);

  return <output data-registered={String(panels.isAvailable)} data-testid="panel-registration" />;
}

function getSidebarPanelOrder(sidebar: HTMLElement) {
  const group = sidebar.querySelector<HTMLElement>('[data-slot="resizable-panel-group"]');
  expect(group).not.toBeNull();

  return Array.from(group!.children).map((child) => {
    if (child.hasAttribute("data-panel")) return child.id;
    if (child.hasAttribute("data-separator")) return "separator";
    return "other";
  });
}

function expectValidPanelLayout(sidebar: HTMLElement, viewIds: Array<"activity" | "sources">) {
  const panelIds = {
    activity: "editor-source-activity-feed",
    sources: "editor-source-imported-sources",
  };

  expect(getSidebarPanelOrder(sidebar)).toEqual(
    viewIds.flatMap((viewId, index) => [...(index > 0 ? ["separator"] : []), panelIds[viewId]]),
  );

  for (const viewId of viewIds) {
    const frame = sidebar.querySelector<HTMLElement>(`[data-sidebar-view="${viewId}"]`);
    const panel = frame?.closest<HTMLElement>("[data-panel]");
    expect(panel?.id).toBe(panelIds[viewId]);
    expect(Number.parseFloat(panel?.style.flexGrow ?? "0")).toBeGreaterThan(0);
  }
}

describe("AppLayout drag and resize integration", () => {
  it("reorders real draggable panels without corrupting the resizable group across repeated drags", async () => {
    class IntersectionObserverMock implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin: string;
      readonly scrollMargin = "0px";
      readonly thresholds: number[];

      constructor(
        private readonly callback: IntersectionObserverCallback,
        options: IntersectionObserverInit = {},
      ) {
        this.rootMargin = options.rootMargin ?? "0px";
        this.thresholds = Array.isArray(options.threshold)
          ? options.threshold
          : [options.threshold ?? 0];
      }

      disconnect() {}

      observe(target: Element) {
        if (this.rootMargin !== "0px") return;

        const rect = target.getBoundingClientRect();
        this.callback(
          [
            {
              boundingClientRect: rect,
              intersectionRatio: 1,
              intersectionRect: rect,
              isIntersecting: true,
              rootBounds: rect,
              target,
              time: 0,
            } as IntersectionObserverEntry,
          ],
          this,
        );
      }

      takeRecords() {
        return [];
      }

      unobserve() {}
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    Object.defineProperty(window.PointerEvent.prototype, "pointerType", {
      configurable: true,
      get: () => "mouse",
    });
    Object.defineProperty(document, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: "",
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }));
    const store = configureStore({ reducer: { preferences: preferencesReducer } });

    render(
      <Provider store={store}>
        <ResizablePanelContextProvider>
          <PanelRegistrationProbe />
          <AppLayout />
        </ResizablePanelContextProvider>
      </Provider>,
    );

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    const sourcesPanel = sidebar.querySelector<HTMLElement>("#editor-source-imported-sources")!;
    const activityPanel = sidebar.querySelector<HTMLElement>("#editor-source-activity-feed")!;
    const sourcesFrame = sidebar.querySelector<HTMLElement>('[data-sidebar-view="sources"]')!;
    const activityFrame = sidebar.querySelector<HTMLElement>('[data-sidebar-view="activity"]')!;
    const panelGroup = sidebar.querySelector<HTMLElement>('[data-slot="resizable-panel-group"]')!;
    const sidebarRegion = sidebar;

    setBounds(sidebarRegion, 0, 700);
    setBounds(panelGroup, 0, 700);
    setBounds(sourcesPanel, 0, 300);
    setBounds(sourcesFrame, 0, 300);
    setBounds(activityPanel, 300, 600);
    setBounds(activityFrame, 300, 600);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => sidebar,
    });

    await waitFor(() => {
      expect(screen.getByTestId("panel-registration")).toHaveAttribute("data-registered", "true");
    });
    expectValidPanelLayout(sidebar, ["sources", "activity"]);

    const panelSizes = new Map(
      [sourcesPanel, activityPanel].map((panel) => [panel.id, panel.style.flexGrow]),
    );

    const originalSourcePanel = sourcesPanel;
    const originalActivityPanel = activityPanel;

    const dragView = async (
      viewId: "activity" | "sources",
      y: number,
      expectedViews: Array<"activity" | "sources">,
      expectedIndex: number,
      beforeSecondMove?: () => void,
    ) => {
      fireEvent.click(
        screen.getByRole("button", {
          name: viewId === "sources" ? "Begin Sources drag" : "Begin Activity drag",
        }),
      );
      await Promise.resolve();
      fireEvent.click(
        screen.getByRole("button", {
          name: y > 350 ? "Move drag below panels" : "Move drag above panels",
        }),
      );
      beforeSecondMove?.();
      fireEvent.click(
        screen.getByRole("button", {
          name: y > 350 ? "Move drag below panels" : "Move drag above panels",
        }),
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-sidebar-drop-placeholder="left"]'),
        ).toBeInTheDocument();
        expectValidPanelLayout(sidebar, expectedViews);
        const placeholder = document.querySelector('[data-sidebar-drop-placeholder="left"]');
        expect(placeholder).toHaveAttribute(
          "data-sidebar-drop-placeholder-index",
          String(expectedIndex),
        );
        expect(placeholder).toHaveClass(
          "absolute",
          "inset-0",
          "rounded-lg",
          "border-2",
          "border-dashed",
          "bg-primary/5",
        );
        expect(placeholder?.closest(`[data-sidebar-view="${viewId}"]`)).toBeInTheDocument();
        expect(placeholder?.closest("[data-panel]")?.id).toBe(
          viewId === "sources" ? "editor-source-imported-sources" : "editor-source-activity-feed",
        );
        const dragPreview = document.querySelector(`[data-sidebar-drag-preview="${viewId}"]`);
        expect(dragPreview).toBeInTheDocument();
        expect(dragPreview?.parentElement).toBe(document.body);
        expect(dragPreview?.closest('[data-slot="resizable-panel-group"]')).toBeNull();
        expect(dragPreview).toHaveTextContent(
          viewId === "sources" ? "Imported Sources" : "Activity Feed",
        );
        expect(dragPreview?.querySelector("svg")).toBeInTheDocument();
        expect(dragPreview).toHaveStyle({
          left: "100px",
          top: `${y > 350 ? 650 : 50}px`,
          transform: "translate(12px, 12px)",
        });
        expect(screen.getByTestId("panel-registration")).toHaveAttribute("data-registered", "true");
      });

      fireEvent.click(screen.getByRole("button", { name: "Finish drag" }));

      await waitFor(() => {
        expect(document.querySelector('[data-sidebar-drop-placeholder="left"]')).toBeNull();
        expect(document.querySelector("[data-sidebar-drag-preview]")).toBeNull();
      });
    };

    setBounds(activityPanel, 300, 336);
    setBounds(activityFrame, 300, 336);
    await dragView("sources", 650, ["activity", "sources"], 1, () => {
      // Simulate sortable displacement and a collapsed panel while the pointer remains at the
      // same coordinate. Placement should use the panel geometry captured at drag start.
      setBounds(activityPanel, 800, 836);
      setBounds(activityFrame, 800, 900);
    });
    expect(store.getState().preferences.sidebarLayout.left).toEqual(["activity", "sources"]);
    expectValidPanelLayout(sidebar, ["activity", "sources"]);
    expect(screen.getByTestId("panel-registration")).toHaveAttribute("data-registered", "true");
    expect(sidebar.querySelector("#editor-source-imported-sources")).toBe(originalSourcePanel);
    expect(sidebar.querySelector("#editor-source-activity-feed")).toBe(originalActivityPanel);

    setBounds(activityPanel, 0, 36);
    setBounds(activityFrame, 0, 36);
    setBounds(sourcesPanel, 36, 700);
    setBounds(sourcesFrame, 36, 700);
    await dragView("activity", 650, ["sources", "activity"], 1);
    expect(store.getState().preferences.sidebarLayout.left).toEqual(["sources", "activity"]);
    expectValidPanelLayout(sidebar, ["sources", "activity"]);
    expect(sourcesPanel.style.flexGrow).toBe(panelSizes.get(sourcesPanel.id));
    expect(activityPanel.style.flexGrow).toBe(panelSizes.get(activityPanel.id));

    const separators = sidebar.querySelectorAll('[data-slot="resizable-handle"]');
    expect(separators).toHaveLength(1);
    expect(separators[0]?.previousElementSibling).toBe(originalSourcePanel);
    expect(separators[0]?.nextElementSibling).toBe(originalActivityPanel);

    setBounds(sourcesPanel, 0, 300);
    setBounds(sourcesFrame, 0, 300);
    setBounds(activityPanel, 300, 700);
    setBounds(activityFrame, 300, 700);
    await dragView("activity", 50, ["activity", "sources"], 0);
    expect(store.getState().preferences.sidebarLayout.left).toEqual(["activity", "sources"]);

    fireEvent.click(screen.getByRole("button", { name: "Begin Activity drag" }));
    await waitFor(() => {
      expect(document.querySelector('[data-sidebar-drag-preview="activity"]')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Move drag below panels" }));
    fireEvent.click(screen.getByRole("button", { name: "Move drag below panels" }));
    expect(document.querySelector('[data-sidebar-drop-placeholder="left"]')).toBeInTheDocument();
    expect(document.querySelector('[data-sidebar-drag-preview="activity"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel drag" }));
    await waitFor(() => {
      expect(document.querySelector('[data-sidebar-drop-placeholder="left"]')).toBeNull();
      expect(document.querySelector("[data-sidebar-drag-preview]")).toBeNull();
    });
    expect(store.getState().preferences.sidebarLayout.left).toEqual(["activity", "sources"]);
  });
});
