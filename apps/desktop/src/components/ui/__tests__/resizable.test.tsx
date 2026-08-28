import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode, type RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "../resizable";

type PanelController = {
  collapse: ReturnType<typeof vi.fn>;
  expand: ReturnType<typeof vi.fn>;
  getSize: ReturnType<typeof vi.fn>;
  isCollapsed: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
};

type CapturedPanelProps = {
  children?: ReactNode;
  collapsedSize?: number | string;
  defaultSize?: number | string;
  id: string;
  onResize?: (
    size: { asPercentage: number; inPixels: number },
    panelId: string,
    previousSize?: { asPercentage: number; inPixels: number },
  ) => void;
  panelRef: RefObject<PanelController | null>;
};

type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

const primitive = vi.hoisted(() => ({
  controllers: new Map<string, PanelController>(),
  props: new Map<string, CapturedPanelProps>(),
  collapsed: new Map<string, boolean>(),
}));

vi.mock("react-resizable-panels", async () => {
  const React = await import("react");

  const reportResize = (id: string, collapsed: boolean) => {
    primitive.collapsed.set(id, collapsed);
    const asPercentage = collapsed ? 0 : 50;
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
        const initiallyCollapsed =
          props.collapsedSize !== undefined && props.defaultSize === props.collapsedSize;
        primitive.collapsed.set(id, initiallyCollapsed);
        controller = {
          collapse: vi.fn(() => reportResize(id, true)),
          expand: vi.fn(() => reportResize(id, false)),
          getSize: vi.fn(() => ({ asPercentage: 50, inPixels: 500 })),
          isCollapsed: vi.fn(() => primitive.collapsed.get(id) ?? false),
          resize: vi.fn(),
        };
        primitive.controllers.set(id, controller);
      }

      primitive.props.set(id, props);
      props.panelRef.current = controller;

      return <div>{props.children}</div>;
    },
    Separator: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    useDefaultLayout: ({
      id,
      panelIds,
      storage = localStorage,
    }: {
      id: string;
      panelIds: string[];
      storage?: LayoutStorage;
    }) => {
      const storageKey = `react-resizable-panels:${[id, ...panelIds].join(":")}`;
      const savedLayout = storage.getItem(storageKey);

      return {
        defaultLayout: savedLayout ? JSON.parse(savedLayout) : undefined,
        onLayoutChange: vi.fn(),
        onLayoutChanged: vi.fn(),
      };
    },
    useGroupRef: () => React.useRef(null),
    usePanelRef: () => React.useRef(null),
  };
});

beforeEach(() => {
  primitive.controllers.clear();
  primitive.props.clear();
  primitive.collapsed.clear();
  localStorage.clear();
});

function DynamicPanelGroup() {
  const [showSecondPanel, setShowSecondPanel] = useState(false);

  return (
    <ResizablePanelContextProvider>
      <button onClick={() => setShowSecondPanel(true)}>Show second panel</button>
      <div style={{ height: 500 }}>
        <ResizablePanelGroup id="dynamic-panels" persisted orientation="vertical">
          <ResizablePanel id="first-panel" minSize={100}>
            First panel
          </ResizablePanel>
          {showSecondPanel ? (
            <>
              <ResizableHandle />
              <ResizablePanel id="second-panel" minSize={100}>
                Second panel
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
    </ResizablePanelContextProvider>
  );
}

describe("ResizablePanelGroup", () => {
  it("loads persisted layouts for panels nested in fragments", () => {
    const storageKey = "react-resizable-panels:fragment-panels:first-panel:second-panel";
    const savedLayout = { "first-panel": 35, "second-panel": 65 };
    const storage = {
      getItem: vi.fn((key: string) => (key === storageKey ? JSON.stringify(savedLayout) : null)),
      setItem: vi.fn(),
    };

    render(
      <ResizablePanelContextProvider>
        <div style={{ height: 500 }}>
          <ResizablePanelGroup
            id="fragment-panels"
            persisted
            orientation="vertical"
            storage={storage}
          >
            <ResizablePanel id="first-panel">First panel</ResizablePanel>
            <>
              <ResizableHandle />
              <ResizablePanel id="second-panel">Second panel</ResizablePanel>
            </>
          </ResizablePanelGroup>
        </div>
      </ResizablePanelContextProvider>,
    );

    expect(storage.getItem).toHaveBeenCalledWith(storageKey);
    expect(storage.getItem).not.toHaveBeenCalledWith(
      "react-resizable-panels:fragment-panels:first-panel",
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("registers a panel added after the initial mount", () => {
    render(<DynamicPanelGroup />);

    fireEvent.click(screen.getByRole("button", { name: "Show second panel" }));

    expect(screen.getByText("Second panel")).toBeInTheDocument();
  });
});

function ControlHarness({ mode }: { mode: "toggle" | "collapse" | "expand" | "reset" }) {
  return (
    <ResizablePanelContextProvider>
      <ResizablePanelGroup>
        <ResizablePanel id="open-panel" collapsible collapsedSize={0} defaultSize={50} />
        <ResizablePanel id="collapsed-panel" collapsible collapsedSize={0} defaultSize={0} />
      </ResizablePanelGroup>

      <ResizablePanelControl panelId={["open-panel", "collapsed-panel"]} mode={mode}>
        {({ isCollapsed, isMixed }) => (
          <button
            data-collapsed={String(isCollapsed)}
            data-mixed={String(isMixed)}
            aria-label="Run control"
          >
            Run control
          </button>
        )}
      </ResizablePanelControl>

      <ResizablePanelControl panelId="collapsed-panel">
        {({ isCollapsed }) => <span data-testid="collapsed-state">{String(isCollapsed)}</span>}
      </ResizablePanelControl>
    </ResizablePanelContextProvider>
  );
}

async function renderControl(mode: "toggle" | "collapse" | "expand" | "reset") {
  render(<ControlHarness mode={mode} />);
  await waitFor(() => expect(screen.getByTestId("collapsed-state")).toHaveTextContent("true"));

  return {
    collapsedPanel: primitive.controllers.get("collapsed-panel")!,
    openPanel: primitive.controllers.get("open-panel")!,
  };
}

function reportPanelResize(id: string, collapsed: boolean) {
  primitive.collapsed.set(id, collapsed);
  const asPercentage = collapsed ? 0 : 50;
  primitive.props.get(id)?.onResize?.({ asPercentage, inPixels: asPercentage * 10 }, id, undefined);
}

describe("ResizablePanelControl", () => {
  it("reports mixed state when target panels differ", async () => {
    await renderControl("toggle");

    expect(screen.getByRole("button", { name: "Run control" })).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Run control" })).toHaveAttribute(
      "data-mixed",
      "true",
    );
  });

  it("toggles each panel according to its own state", async () => {
    const { collapsedPanel, openPanel } = await renderControl("toggle");

    fireEvent.click(screen.getByRole("button", { name: "Run control" }));

    expect(openPanel.collapse).toHaveBeenCalledOnce();
    expect(openPanel.expand).not.toHaveBeenCalled();
    expect(collapsedPanel.expand).toHaveBeenCalledOnce();
    expect(collapsedPanel.collapse).not.toHaveBeenCalled();
  });

  it("only collapses panels that are open", async () => {
    const { collapsedPanel, openPanel } = await renderControl("collapse");

    fireEvent.click(screen.getByRole("button", { name: "Run control" }));

    expect(openPanel.collapse).toHaveBeenCalledOnce();
    expect(collapsedPanel.collapse).not.toHaveBeenCalled();
    expect(openPanel.expand).not.toHaveBeenCalled();
    expect(collapsedPanel.expand).not.toHaveBeenCalled();
  });

  it("only expands panels that are collapsed", async () => {
    const { collapsedPanel, openPanel } = await renderControl("expand");

    fireEvent.click(screen.getByRole("button", { name: "Run control" }));

    expect(collapsedPanel.expand).toHaveBeenCalledOnce();
    expect(openPanel.expand).not.toHaveBeenCalled();
    expect(openPanel.collapse).not.toHaveBeenCalled();
    expect(collapsedPanel.collapse).not.toHaveBeenCalled();
  });

  it("resets each panel to the collapsed state captured on mount", async () => {
    const { collapsedPanel, openPanel } = await renderControl("reset");

    act(() => {
      reportPanelResize("open-panel", true);
      reportPanelResize("collapsed-panel", false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run control" }));

    expect(openPanel.expand).toHaveBeenCalledOnce();
    expect(openPanel.collapse).not.toHaveBeenCalled();
    expect(collapsedPanel.collapse).toHaveBeenCalledOnce();
    expect(collapsedPanel.expand).not.toHaveBeenCalled();
  });
});
