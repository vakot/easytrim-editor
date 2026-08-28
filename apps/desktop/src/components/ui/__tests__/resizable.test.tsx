import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode, RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelGroup,
  ResizablePanelToggle,
} from "../resizable";

type PanelSize = {
  asPercentage: number;
  inPixels: number;
};

type CapturedPanelProps = {
  children?: ReactNode;
  collapsedSize?: number | string;
  disabled?: boolean;
  id: string;
  maxSize?: number | string;
  minSize?: number | string;
  onResize?: (size: PanelSize, id: string, previousSize?: PanelSize) => void;
  panelRef: RefObject<PanelController | null>;
};

type PanelController = {
  collapsed: boolean;
  disabledWhenResized: boolean[];
  collapse: ReturnType<typeof vi.fn>;
  expand: ReturnType<typeof vi.fn>;
  getSize: ReturnType<typeof vi.fn>;
  isCollapsed: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
};

const primitive = vi.hoisted(() => ({
  controllers: new Map<string, PanelController>(),
  props: new Map<string, CapturedPanelProps>(),
}));

vi.mock("react-resizable-panels", async () => {
  const React = await import("react");

  const reportResize = (id: string, asPercentage: number) => {
    primitive.props
      .get(id)
      ?.onResize?.({ asPercentage, inPixels: asPercentage * 10 }, id, undefined);
  };

  return {
    Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Panel: (props: CapturedPanelProps) => {
      const id = props.id;
      let controller = primitive.controllers.get(id);

      if (!controller) {
        controller = {
          collapsed: false,
          disabledWhenResized: [],
          collapse: vi.fn(() => {
            controller!.collapsed = true;
            reportResize(id, 0);
          }),
          expand: vi.fn(() => {
            controller!.collapsed = false;
            reportResize(id, 50);
          }),
          getSize: vi.fn(() => ({ asPercentage: 50, inPixels: 500 })),
          isCollapsed: vi.fn(() => controller!.collapsed),
          resize: vi.fn((size: number | string) => {
            controller!.disabledWhenResized.push(primitive.props.get(id)?.disabled ?? false);
            controller!.collapsed = false;
            reportResize(id, Number.parseFloat(String(size)));
          }),
        };
        primitive.controllers.set(id, controller);
      }

      primitive.props.set(id, props);
      props.panelRef.current = controller;

      return <div data-testid={id}>{props.children}</div>;
    },
    Separator: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    useDefaultLayout: () => ({
      defaultLayout: undefined,
      onLayoutChange: vi.fn(),
      onLayoutChanged: vi.fn(),
    }),
    useGroupRef: () => React.useRef(null),
    usePanelRef: () => React.useRef(null),
  };
});

function renderPanel({
  collapsibleMode,
  collapsedSize,
  minSize,
}: {
  collapsibleMode?: "default" | "forced";
  collapsedSize?: number | string;
  minSize?: number | string;
} = {}) {
  render(
    <ResizablePanelContextProvider>
      <ResizablePanelGroup>
        <ResizablePanel
          id="panel"
          collapsible
          collapsibleMode={collapsibleMode}
          collapsedSize={collapsedSize}
          minSize={minSize}
          maxSize="80%"
        >
          <ResizablePanelToggle panelId="panel">
            {(collapsed) => <button>{collapsed ? "Open" : "Close"}</button>}
          </ResizablePanelToggle>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanelContextProvider>,
  );
}

function reportPanelResize(asPercentage: number, collapsed: boolean) {
  const controller = primitive.controllers.get("panel");
  const props = primitive.props.get("panel");

  if (!controller || !props) throw new Error("Panel mock was not rendered");

  controller.collapsed = collapsed;
  act(() => {
    props.onResize?.({ asPercentage, inPixels: asPercentage * 10 }, "panel", undefined);
  });
}

describe("ResizablePanel", () => {
  beforeEach(() => {
    primitive.controllers.clear();
    primitive.props.clear();
  });

  it("preserves native collapse and expand behavior in default mode", async () => {
    renderPanel({ collapsedSize: 0, minSize: "20%" });
    await screen.findByRole("button", { name: "Close" });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    const controller = primitive.controllers.get("panel")!;
    expect(controller.collapse).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(primitive.props.get("panel")).toMatchObject({
      collapsedSize: 0,
      disabled: undefined,
      maxSize: "80%",
      minSize: "20%",
    });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(controller.expand).toHaveBeenCalledOnce();
    expect(controller.resize).not.toHaveBeenCalled();
  });

  it("locks a forced collapsed panel and restores its latest open percentage", async () => {
    renderPanel({ collapsibleMode: "forced", collapsedSize: 28, minSize: 120 });
    await screen.findByRole("button", { name: "Close" });

    reportPanelResize(42, false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(primitive.props.get("panel")).toMatchObject({
        disabled: true,
        maxSize: 28,
        minSize: 28,
      });
    });

    const controller = primitive.controllers.get("panel")!;
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(controller.resize).toHaveBeenCalledWith("42%"));
    expect(controller.disabledWhenResized).toEqual([false]);
    expect(controller.expand).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("falls back to expand when a forced panel has no remembered open size", async () => {
    renderPanel({ collapsibleMode: "forced", collapsedSize: 0, minSize: "20%" });
    await screen.findByRole("button", { name: "Close" });

    reportPanelResize(0, true);
    expect(await screen.findByRole("button", { name: "Open" })).toBeInTheDocument();

    const controller = primitive.controllers.get("panel")!;
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(controller.expand).toHaveBeenCalledOnce());
    expect(controller.resize).not.toHaveBeenCalled();
  });
});
