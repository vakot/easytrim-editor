import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider, usePanelCommand } from "@/components/ui/resizable";

import { AppLayout } from "@/app/layout/AppLayout";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";

const draggableElements = vi.hoisted(() => new Map<string, HTMLElement>());

vi.mock("@/app/layout/components/AppLayoutHeader", () => ({
  AppLayoutHeader: () => <header />,
}));

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

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({
    children,
    onDragEnd,
    onDragMove,
    onDragStart,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: unknown) => void;
    onDragMove: (event: unknown) => void;
    onDragStart: (event: unknown) => void;
  }) => (
    <>
      {children}
      <button
        aria-label="Preview Sources below Activity"
        onClick={() => {
          onDragStart({
            operation: {
              position: { current: { x: 120, y: 590 } },
              source: { id: "sources" },
            },
          });
          onDragMove({
            canceled: false,
            operation: { position: { current: { x: 120, y: 590 } }, source: { id: "sources" } },
          });
        }}
        type="button"
      />
      <button
        aria-label="Drop Sources below Activity"
        onClick={() =>
          onDragEnd({
            canceled: false,
            operation: { position: { current: { x: 120, y: 590 } }, source: { id: "sources" } },
          })
        }
        type="button"
      />
      <button
        aria-label="Simulate moving Sources to the bottom of the left sidebar"
        onClick={() => {
          onDragStart({
            operation: {
              position: { current: { x: 120, y: 590 } },
              source: { id: "sources" },
            },
          });
          const event = {
            canceled: false,
            operation: { position: { current: { x: 120, y: 590 } }, source: { id: "sources" } },
          };

          onDragMove(event);
          onDragEnd(event);
        }}
        type="button"
      />
      <button
        aria-label="Simulate moving Activity Feed to the right sidebar"
        onClick={() => {
          onDragStart({
            operation: {
              position: { current: { x: 1100, y: 350 } },
              source: { id: "activity" },
            },
          });
          const event = {
            canceled: false,
            operation: { position: { current: { x: 1100, y: 350 } }, source: { id: "activity" } },
          };

          onDragMove(event);
          onDragEnd(event);
        }}
        type="button"
      />
      <button
        aria-label="Preview moving Sources to the right sidebar"
        onClick={() => {
          onDragStart({
            operation: {
              position: { current: { x: 1100, y: 350 } },
              source: { id: "sources" },
            },
          });
          onDragMove({
            canceled: false,
            operation: { position: { current: { x: 1100, y: 350 } }, source: { id: "sources" } },
          });
        }}
        type="button"
      />
      <button
        aria-label="Drop Sources into the right sidebar"
        onClick={() =>
          onDragEnd({
            canceled: false,
            operation: { position: { current: { x: 1100, y: 350 } }, source: { id: "sources" } },
          })
        }
        type="button"
      />
      <button
        aria-label="Simulate moving Sources to the right sidebar"
        onClick={() => {
          onDragStart({
            operation: {
              position: { current: { x: 1100, y: 350 } },
              source: { id: "sources" },
            },
          });
          const event = {
            canceled: false,
            operation: { position: { current: { x: 1100, y: 350 } }, source: { id: "sources" } },
          };

          onDragMove(event);
          onDragEnd(event);
        }}
        type="button"
      />
    </>
  ),
  useDroppable: () => ({ isDropTarget: false, ref: () => undefined }),
  useDraggable: ({ id }: { id: string }) => ({
    isDragging: false,
    handleRef: () => undefined,
    ref: (element: Element | null) => {
      if (element) draggableElements.set(id, element as HTMLElement);
    },
  }),
}));

function setBounds(element: HTMLElement, bounds: DOMRect) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => bounds,
  });
}

function renderAppLayout() {
  const store = configureStore({ reducer: { preferences: preferencesReducer } });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1280,
    bottom: 800,
    width: 1280,
    height: 800,
  } as DOMRect);

  render(
    <Provider store={store}>
      <ResizablePanelContextProvider>
        <SidebarPanelRegistrationProbe />
        <AppLayout />
      </ResizablePanelContextProvider>
    </Provider>,
  );

  return store;
}

function SidebarPanelRegistrationProbe() {
  const sources = usePanelCommand("editor-source-imported-sources");
  const activity = usePanelCommand("editor-source-activity-feed");

  return (
    <output
      data-activity-panel-registered={String(activity.isAvailable)}
      data-sources-panel-registered={String(sources.isAvailable)}
      data-testid="sidebar-panel-registration"
    />
  );
}

function expectPanelStructure(sidebar: HTMLElement, viewIds: Array<"activity" | "sources">) {
  const group = sidebar.querySelector<HTMLElement>('[data-slot="resizable-panel-group"]');
  expect(group).not.toBeNull();

  const panelIds: Record<"activity" | "sources", string> = {
    activity: "editor-source-activity-feed",
    sources: "editor-source-imported-sources",
  };

  const expectedChildren = viewIds.flatMap((viewId, index) => [
    ...(index > 0 ? ["separator"] : []),
    `panel:${panelIds[viewId]}`,
  ]);

  const actualChildren = Array.from(group!.children).map((child) => {
    if (child.hasAttribute("data-panel")) return `panel:${child.id}`;
    if (child.hasAttribute("data-separator")) return "separator";
    return "other";
  });

  expect(actualChildren).toEqual(expectedChildren);
  for (const viewId of viewIds) {
    const frame = sidebar.querySelector<HTMLElement>(`[data-sidebar-view="${viewId}"]`);
    const panel = frame?.closest("[data-panel]");
    expect(panel?.id).toBe(panelIds[viewId]);
    expect(draggableElements.get(viewId)).toBe(panel);
  }
}

describe("AppLayout sidebar drag and drop", () => {
  it("renders separators only for sidebars that are present", async () => {
    renderAppLayout();

    expect(document.querySelectorAll(".workspace-separator")).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Simulate moving Activity Feed to the right sidebar" }),
    );

    await waitFor(() => {
      expect(document.querySelectorAll(".workspace-separator")).toHaveLength(2);
    });
  });

  it("updates the rendered panel order after a sidebar drop", async () => {
    const store = renderAppLayout();

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    const rightDropTarget = document.querySelector<HTMLElement>(
      '[data-sidebar-empty-drop-target="right"]',
    )!;

    const sources = sidebar.querySelector<HTMLElement>('[data-sidebar-view="sources"]')!;
    const activity = sidebar.querySelector<HTMLElement>('[data-sidebar-view="activity"]')!;
    setBounds(sidebar, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);
    setBounds(sources, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 300,
      width: 320,
      height: 300,
    } as DOMRect);
    setBounds(activity, {
      x: 0,
      y: 300,
      top: 300,
      left: 0,
      right: 320,
      bottom: 600,
      width: 320,
      height: 300,
    } as DOMRect);
    setBounds(rightDropTarget, {
      x: 1000,
      y: 0,
      top: 0,
      left: 1000,
      right: 1200,
      bottom: 700,
      width: 200,
      height: 700,
    } as DOMRect);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate moving Sources to the bottom of the left sidebar",
      }),
    );

    await waitFor(() => {
      expect(store.getState().preferences.sidebarLayout.left).toEqual(["activity", "sources"]);
    });

    await waitFor(() => {
      expect(
        Array.from(sidebar.querySelectorAll<HTMLElement>("[data-sidebar-view]")).map(
          (item) => item.dataset.sidebarView,
        ),
      ).toEqual(["activity", "sources"]);
    });
  });

  it("keeps each draggable view inside its registered panel and separators between panels", async () => {
    renderAppLayout();

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    const registration = screen.getByTestId("sidebar-panel-registration");
    const sources = sidebar.querySelector<HTMLElement>('[data-sidebar-view="sources"]')!;
    const activity = sidebar.querySelector<HTMLElement>('[data-sidebar-view="activity"]')!;
    const rightDropTarget = document.querySelector<HTMLElement>(
      '[data-sidebar-empty-drop-target="right"]',
    )!;

    setBounds(sidebar, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);
    setBounds(sources, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 300,
      width: 320,
      height: 300,
    } as DOMRect);
    setBounds(activity, {
      x: 0,
      y: 300,
      top: 300,
      left: 0,
      right: 320,
      bottom: 600,
      width: 320,
      height: 300,
    } as DOMRect);
    setBounds(rightDropTarget, {
      x: 1000,
      y: 0,
      top: 0,
      left: 1000,
      right: 1200,
      bottom: 700,
      width: 200,
      height: 700,
    } as DOMRect);

    await waitFor(() => {
      expect(registration).toHaveAttribute("data-sources-panel-registered", "true");
      expect(registration).toHaveAttribute("data-activity-panel-registered", "true");
    });
    expectPanelStructure(sidebar, ["sources", "activity"]);
    const panelElementsBeforeDrop = new Map([
      ["sources", draggableElements.get("sources")],
      ["activity", draggableElements.get("activity")],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Preview Sources below Activity" }));

    expectPanelStructure(sidebar, ["sources", "activity"]);
    expect(registration).toHaveAttribute("data-sources-panel-registered", "true");
    expect(registration).toHaveAttribute("data-activity-panel-registered", "true");

    fireEvent.click(screen.getByRole("button", { name: "Drop Sources below Activity" }));

    await waitFor(() => {
      expectPanelStructure(sidebar, ["activity", "sources"]);
      expect(registration).toHaveAttribute("data-sources-panel-registered", "true");
      expect(registration).toHaveAttribute("data-activity-panel-registered", "true");
      expect(draggableElements.get("sources")).toBe(panelElementsBeforeDrop.get("sources"));
      expect(draggableElements.get("activity")).toBe(panelElementsBeforeDrop.get("activity"));
    });
  });

  it("creates the destination sidebar after dropping a view into an empty region", async () => {
    const store = renderAppLayout();
    const activity = screen
      .getByRole("complementary", { name: "Left sidebar" })
      .querySelector<HTMLElement>('[data-sidebar-view="activity"]')!;

    const rightDropTarget = document.querySelector<HTMLElement>(
      '[data-sidebar-empty-drop-target="right"]',
    )!;

    setBounds(activity, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 300,
      width: 320,
      height: 300,
    } as DOMRect);
    setBounds(rightDropTarget, {
      x: 1000,
      y: 0,
      top: 0,
      left: 1000,
      right: 1200,
      bottom: 700,
      width: 200,
      height: 700,
    } as DOMRect);

    fireEvent.click(
      screen.getByRole("button", { name: "Simulate moving Activity Feed to the right sidebar" }),
    );

    await waitFor(() => {
      const destination = screen.getByRole("complementary", { name: "Right sidebar" });
      expect(destination.querySelector('[data-sidebar-view="activity"]')).toBeInTheDocument();
    });
    expect(store.getState().preferences.sidebarLayout.right).toEqual(["activity"]);
    expect(
      screen.getByRole("button", { name: "Drag Activity Feed to move it between sidebars" }),
    ).toBeInTheDocument();

    const leftSidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    const rightSidebar = screen.getByRole("complementary", { name: "Right sidebar" });
    const sources = leftSidebar.querySelector<HTMLElement>('[data-sidebar-view="sources"]')!;
    setBounds(leftSidebar, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);
    setBounds(sources, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 300,
      width: 320,
      height: 300,
    } as DOMRect);
    setBounds(rightSidebar, {
      x: 960,
      y: 0,
      top: 0,
      left: 960,
      right: 1280,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);

    fireEvent.click(
      screen.getByRole("button", { name: "Simulate moving Sources to the right sidebar" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("complementary", { name: "Left sidebar" })).not.toBeInTheDocument();
      expect(document.querySelectorAll(".workspace-separator")).toHaveLength(1);
      expectPanelStructure(
        screen.getByRole("complementary", { name: "Right sidebar" }),
        store.getState().preferences.sidebarLayout.right,
      );
      expect(screen.getByTestId("sidebar-panel-registration")).toHaveAttribute(
        "data-sources-panel-registered",
        "true",
      );
      expect(screen.getByTestId("sidebar-panel-registration")).toHaveAttribute(
        "data-activity-panel-registered",
        "true",
      );
    });
  });

  it("uses the visible populated-sidebar preview index when applying the drop", async () => {
    const store = renderAppLayout();
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate moving Activity Feed to the right sidebar" }),
    );

    const left = document.querySelector<HTMLElement>('[data-sidebar-region="left"]')!;
    const right = document.querySelector<HTMLElement>('[data-sidebar-region="right"]')!;
    const rightActivity = right.querySelector<HTMLElement>('[data-sidebar-view="activity"]')!;
    const rightActivityPanel = rightActivity.closest<HTMLElement>("[data-panel]")!;
    setBounds(left, {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);
    setBounds(right, {
      x: 960,
      y: 0,
      top: 0,
      left: 960,
      right: 1280,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);
    setBounds(rightActivityPanel, {
      x: 960,
      y: 0,
      top: 0,
      left: 960,
      right: 1280,
      bottom: 700,
      width: 320,
      height: 700,
    } as DOMRect);

    fireEvent.click(
      screen.getByRole("button", { name: "Preview moving Sources to the right sidebar" }),
    );

    const indicator = document.querySelector('[data-sidebar-drop-indicator="right"]');
    expect(indicator).toHaveAttribute("data-sidebar-drop-indicator-index", "1");
    expect(indicator).toHaveClass("absolute", "h-1", "bg-primary", "pointer-events-none");
    expect(indicator).toHaveStyle({ top: "700px" });
    expect(indicator?.closest('[data-slot="resizable-panel-group"]')?.id).toBe("workspace");
    const dragPreview = document.querySelector('[data-sidebar-drag-preview="sources"]');
    expect(dragPreview).toBeInTheDocument();
    expect(dragPreview?.parentElement).toBe(document.body);
    expect(dragPreview).toHaveClass("opacity-75");
    expect(dragPreview).toHaveStyle({ left: "1100px", top: "350px" });

    fireEvent.click(screen.getByRole("button", { name: "Drop Sources into the right sidebar" }));

    await waitFor(() => {
      expect(store.getState().preferences.sidebarLayout.right).toEqual(["activity", "sources"]);
    });
    expect(document.querySelector('[data-sidebar-drop-indicator="right"]')).toBeNull();
    expect(document.querySelector("[data-sidebar-drag-preview]")).toBeNull();
  });
});
