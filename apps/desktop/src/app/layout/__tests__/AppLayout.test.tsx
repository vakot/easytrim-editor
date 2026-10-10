import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";

import { AppLayout } from "@/app/layout/AppLayout";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";

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
    onDragStart,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: unknown) => void;
    onDragStart: () => void;
  }) => (
    <>
      {children}
      <button
        aria-label="Simulate moving Sources to the bottom of the left sidebar"
        onClick={() => {
          onDragStart();
          onDragEnd({
            canceled: false,
            operation: { position: { current: { x: 120, y: 590 } }, source: { id: "sources" } },
          });
        }}
        type="button"
      />
      <button
        aria-label="Simulate moving Activity Feed to the right sidebar"
        onClick={() => {
          onDragStart();
          onDragEnd({
            canceled: false,
            operation: { position: { current: { x: 1100, y: 350 } }, source: { id: "activity" } },
          });
        }}
        type="button"
      />
      <button
        aria-label="Simulate moving Sources to the right sidebar"
        onClick={() => {
          onDragStart();
          onDragEnd({
            canceled: false,
            operation: { position: { current: { x: 1100, y: 350 } }, source: { id: "sources" } },
          });
        }}
        type="button"
      />
    </>
  ),
  useDroppable: () => ({ isDropTarget: false, ref: () => undefined }),
}));

vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: () => ({ handleRef: () => undefined, isDragging: false, ref: () => undefined }),
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
        <AppLayout />
      </ResizablePanelContextProvider>
    </Provider>,
  );

  return store;
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
    });
  });
});
