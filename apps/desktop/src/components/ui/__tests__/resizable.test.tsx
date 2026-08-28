import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelGroup,
} from "../resizable";

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
