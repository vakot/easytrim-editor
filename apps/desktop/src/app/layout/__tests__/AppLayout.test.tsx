import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function createDataTransfer(): DataTransfer {
  const data: Record<string, string> = {};

  return {
    dropEffect: "none",
    effectAllowed: "all",
    getData: (type: string) => data[type] ?? "",
    setData: (type: string, value: string) => {
      data[type] = value;
    },
  } as unknown as DataTransfer;
}

function dispatchDragEvent(
  target: HTMLElement,
  type: "dragover" | "drop",
  dataTransfer: DataTransfer,
  clientY: number,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  target.dispatchEvent(event);
}

function renderAppLayout() {
  const store = configureStore({ reducer: { preferences: preferencesReducer } });

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
  it("updates the rendered panel order after a sidebar drop", async () => {
    const store = renderAppLayout();

    const sidebar = screen.getByRole("complementary", { name: "Left sidebar" });
    const sources = sidebar.querySelector<HTMLElement>('[data-sidebar-view="sources"]')!;
    const activity = sidebar.querySelector<HTMLElement>('[data-sidebar-view="activity"]')!;
    const transfer = createDataTransfer();

    vi.spyOn(sidebar, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    vi.spyOn(sources, "getBoundingClientRect").mockReturnValue({
      top: 10,
      bottom: 110,
      height: 100,
    } as DOMRect);
    vi.spyOn(activity, "getBoundingClientRect").mockReturnValue({
      top: 120,
      bottom: 220,
      height: 100,
    } as DOMRect);
    fireEvent.dragStart(
      screen.getByRole("button", { name: "Drag Activity Feed to move it between sidebars" }),
      { dataTransfer: transfer },
    );
    expect(
      screen.getByRole("button", { name: "Drag Activity Feed to move it between sidebars" }),
    ).toHaveAttribute("data-dragging", "true");
    act(() => dispatchDragEvent(sidebar, "dragover", transfer, 20));
    expect(sidebar.isConnected).toBe(true);
    expect(sidebar).toBe(screen.getByRole("complementary", { name: "Left sidebar" }));
    act(() => dispatchDragEvent(sidebar, "drop", transfer, 180));

    expect(transfer.getData("application/x-easytrim-sidebar-view")).toBe("activity");
    expect(store.getState().preferences.sidebarLayout.left).toEqual(["activity", "sources"]);

    await waitFor(() => {
      expect(
        Array.from(sidebar.querySelectorAll<HTMLElement>("[data-sidebar-view]")).map(
          (item) => item.dataset.sidebarView,
        ),
      ).toEqual(["activity", "sources"]);
    });
  });

  it("creates the destination sidebar after dropping a view into an empty region", async () => {
    renderAppLayout();
    const transfer = createDataTransfer();

    fireEvent.dragStart(
      screen.getByRole("button", { name: "Drag Activity Feed to move it between sidebars" }),
      { dataTransfer: transfer },
    );

    const emptyRightSidebar = screen.getByRole("region", { name: "Right sidebar" });
    fireEvent.dragOver(emptyRightSidebar, { dataTransfer: transfer });
    fireEvent.drop(emptyRightSidebar, { dataTransfer: transfer });

    await waitFor(() => {
      const destination = screen.getByRole("complementary", { name: "Right sidebar" });
      expect(destination.querySelector('[data-sidebar-view="activity"]')).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Drag Activity Feed to move it between sidebars" }),
    ).toBeInTheDocument();
  });
});
