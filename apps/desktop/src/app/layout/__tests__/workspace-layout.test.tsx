import { act, render } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  shouldCollapseWorkspaceSidebar,
  useWorkspaceSidebarResponsiveCollapse,
  WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD,
} from "../workspace-layout";

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0];

const observers: ResizeObserverCallback[] = [];

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observers.push(callback);
  }

  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

function Harness({ sidebar }: { sidebar: { collapse: () => void; isCollapsed: () => boolean } }) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef(sidebar);
  useWorkspaceSidebarResponsiveCollapse(
    workspaceRef,
    sidebarRef as RefObject<{ collapse: () => void; isCollapsed: () => boolean } | null>,
  );
  return <div ref={workspaceRef} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
  observers.length = 0;
});

describe("workspace sidebar responsive collapse", () => {
  it("keeps the sidebar open when enough workspace width is available", () => {
    expect(shouldCollapseWorkspaceSidebar(WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD)).toBe(false);
  });

  it("collapses the sidebar below the available-width threshold", () => {
    const collapse = vi.fn();
    let collapsed = false;
    const sidebar = {
      collapse: () => {
        collapsed = true;
        collapse();
      },
      isCollapsed: () => collapsed,
    };

    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const { container } = render(<Harness sidebar={sidebar} />);
    Object.defineProperty(container.firstChild, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ width: 1_300 }),
    });

    act(() => {
      observers[0]?.(
        [{ contentRect: { width: 1_300 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(collapse).toHaveBeenCalledOnce();
  });

  it("does not expand the sidebar when the workspace widens", () => {
    const collapse = vi.fn();
    let collapsed = false;
    const sidebar = {
      collapse: () => {
        collapsed = true;
        collapse();
      },
      isCollapsed: () => collapsed,
    };

    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    render(<Harness sidebar={sidebar} />);

    act(() => {
      observers[0]?.(
        [{ contentRect: { width: 1_300 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      observers[0]?.(
        [{ contentRect: { width: 1_500 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(collapse).toHaveBeenCalledOnce();
  });
});
