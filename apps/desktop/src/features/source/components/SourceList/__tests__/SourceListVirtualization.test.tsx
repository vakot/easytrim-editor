import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

const virtualizerControl = vi.hoisted(() => {
  let range = { endIndex: 12, startIndex: 0 };
  const listeners = new Set<() => void>();

  return {
    getRange: () => range,
    setRange: (startIndex: number, endIndex: number) => {
      range = { endIndex, startIndex };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("@tanstack/react-virtual", async () => {
  const { useSyncExternalStore } = await import("react");

  return {
    useVirtualizer: (options: {
      count: number;
      estimateSize: (index: number) => number;
      getItemKey: (index: number) => string;
    }) => {
      const range = useSyncExternalStore(
        virtualizerControl.subscribe,
        virtualizerControl.getRange,
        virtualizerControl.getRange,
      );

      return {
        getTotalSize: () =>
          Array.from({ length: options.count }, (_, index) => options.estimateSize(index)).reduce(
            (total, size) => total + size,
            0,
          ),
        getVirtualItems: () => {
          const lastIndex = Math.min(range.endIndex, options.count - 1);
          const firstIndex = Math.min(range.startIndex, lastIndex);
          const items = [];
          let start = 0;
          for (let index = 0; index < Math.max(0, firstIndex); index += 1) {
            start += options.estimateSize(index);
          }
          for (let index = firstIndex; index <= lastIndex; index += 1) {
            const size = options.estimateSize(index);
            items.push({ index, key: options.getItemKey(index), size, start, end: start + size });
            start += size;
          }
          return items;
        },
        measureElement: () => undefined,
        scrollToIndex: (index: number) => virtualizerControl.setRange(index, index + 12),
      };
    },
  };
});

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    AnimatePresence: ({ children }: PropsWithChildren) => children,
    motion: {
      div: (props: Record<string, unknown>) => {
        const { initial, ...htmlProps } = props;
        delete htmlProps.animate;
        delete htmlProps.layout;
        delete htmlProps.transition;
        return React.createElement("div", {
          ...htmlProps,
          style: {
            ...(htmlProps.style as React.CSSProperties),
            ...(initial && typeof initial === "object" ? initial : {}),
          },
        });
      },
    },
    useReducedMotion: () => false,
  };
});

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>()),
  prepareImportedSourceThumbnailsRequested: () => ({ type: "test/thumbnail-request" }),
}));

vi.mock("../../SourceCard", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    SourceCard: ({ children, source }: PropsWithChildren<{ source: { id: string } }>) => (
      <div data-testid={source.id}>{children}</div>
    ),
    SourceCardActions: Container,
    SourceCardDescription: () => null,
    SourceCardMetadata: () => null,
    SourceCardStatusBadge: () => null,
    SourceCardThumbnail: Container,
    SourceCardTitle: () => null,
  };
});

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceClosed,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { SourceList, SourceListContent, SourceListTabs } from "../SourceList";

function createInstances(count: number): EditingInstance[] {
  return Array.from({ length: count }, (_, index) => {
    const source = {
      ...firstSource,
      displayName: `source-${index}.mp4`,
      sourcePath: `C:/Media/source-${index}.mp4`,
    };

    return {
      exportAttempts: [],
      id: `source-${index}`,
      origin: "source-import",
      snapshot: createDefaultEditorSnapshot(source, false),
      sourceAvailability: "available",
    };
  });
}

function renderInViewport(store: ReturnType<typeof createAppStore>, children = <SourceList />) {
  return render(
    <div data-slot="scroll-area-viewport" style={{ height: 600, overflow: "auto" }}>
      <Provider store={store}>{children}</Provider>
    </div>,
  );
}

function getVirtualContent(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-slot^='imported-sources-'] > div > div");
}

function mockRowGeometry() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.dataset.slot === "scroll-area-viewport") {
      return new DOMRect(0, 0, 400, 600);
    }

    const viewport = this.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (viewport && this.hasAttribute("data-virtual-key")) {
      const start = Number.parseFloat(
        this.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? "0",
      );

      const top = start - viewport.scrollTop;
      return new DOMRect(0, top, 400, 128);
    }

    if (viewport && this.querySelector("[data-virtual-key]")) {
      return new DOMRect(0, -viewport.scrollTop, 400, 0);
    }

    return original.call(this);
  });
}

describe("SourceList progressive virtualization", () => {
  beforeEach(() => {
    virtualizerControl.setRange(0, 12);
  });

  it("grows the exposed range near the current boundary", async () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createInstances(500)));
    const { container } = renderInViewport(store);
    const initialHeight = Number.parseFloat(getVirtualContent(container)?.style.height ?? "0");

    expect(initialHeight).toBe(32 * 128);
    expect(screen.queryByTestId("source-499")).not.toBeInTheDocument();

    act(() => virtualizerControl.setRange(24, 31));

    await waitFor(() => expect(getVirtualContent(container)?.style.height).toBe(`${64 * 128}px`));
    expect(container.querySelectorAll("[data-index]").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("source-499")).not.toBeInTheDocument();
  });

  it("keeps rows mounted when a fast scroll reaches the exposed boundary", async () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createInstances(500)));
    const { container } = renderInViewport(store);

    act(() => virtualizerControl.setRange(56, 63));

    await waitFor(() => expect(getVirtualContent(container)?.style.height).toBe(`${96 * 128}px`));
    expect(container.querySelectorAll("[data-index]").length).toBeGreaterThan(0);
    expect(screen.getByTestId("source-56")).toBeInTheDocument();
  });

  it("preserves the visible key and offset when deleting a source above it", async () => {
    const geometry = mockRowGeometry();
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createInstances(100)));
    const { container } = renderInViewport(store);
    const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) throw new Error("Expected the SourceList viewport");
    viewport.scrollTop = 2_600;
    act(() => virtualizerControl.setRange(20, 30));

    const anchorRow = container.querySelector<HTMLElement>("[data-virtual-key='source:source-20']");
    if (!anchorRow) throw new Error("Expected the visible anchor row");
    const anchorOffset = anchorRow.getBoundingClientRect().top;

    act(() => store.dispatch(editingInstanceClosed("source-2")));
    await waitFor(() => expect(screen.queryByTestId("source-2")).not.toBeInTheDocument());
    const restoredAnchor = container.querySelector<HTMLElement>(
      "[data-virtual-key='source:source-20']",
    );

    expect(restoredAnchor).toBeInTheDocument();
    expect(restoredAnchor?.getBoundingClientRect().top).toBe(anchorOffset);
    geometry.mockRestore();
  });

  it("preserves the next visible row position when deleting its anchor source", async () => {
    const geometry = mockRowGeometry();
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createInstances(100)));
    const { container } = renderInViewport(store);
    const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) throw new Error("Expected the SourceList viewport");
    viewport.scrollTop = 2_600;
    act(() => virtualizerControl.setRange(20, 30));
    const anchorOffset =
      container
        .querySelector<HTMLElement>("[data-virtual-key='source:source-20']")
        ?.getBoundingClientRect().top ?? Number.NaN;

    act(() => store.dispatch(editingInstanceClosed("source-20")));
    expect(screen.getByTestId("source-20").closest("[data-source-animation]")).toHaveAttribute(
      "data-source-animation",
      "exiting",
    );
    await waitFor(() => expect(screen.queryByTestId("source-20")).not.toBeInTheDocument());
    const nextRow = container.querySelector<HTMLElement>("[data-virtual-key='source:source-21']");

    expect(nextRow).toBeInTheDocument();
    expect(nextRow?.getBoundingClientRect().top).toBe(anchorOffset);
    geometry.mockRestore();
  });

  it("animates actual additions but keeps virtual range changes animation-free", async () => {
    const store = createAppStore();
    const instances = createInstances(3);
    store.dispatch(editingInstancesAdded(instances.slice(0, 2)));
    const { container } = renderInViewport(store);

    act(() => virtualizerControl.setRange(1, 2));
    expect(screen.queryByTestId("source-2")).not.toBeInTheDocument();
    expect(
      container.querySelector(
        "[data-virtual-key='source:source-1'] [data-source-animation='none']",
      ),
    ).toBeInTheDocument();

    act(() => store.dispatch(editingInstancesAdded([instances[2]!])));

    expect(store.getState().editingInstances.ids).toHaveLength(3);
    const addedCard = screen.getByTestId("source-2");
    const addedRow = addedCard.closest("[data-source-animation]");
    expect(addedRow).toHaveAttribute("data-source-animation", "entering");
    await waitFor(() => expect(addedRow).toHaveAttribute("data-source-animation", "none"));
  });

  it("keeps folder grouping stable while its source rows change", async () => {
    const store = createAppStore();
    const instances = createInstances(4);
    store.dispatch(editingInstancesAdded(instances));
    const { container } = renderInViewport(
      store,
      <TooltipProvider>
        <SourceList>
          <SourceListTabs />
          <SourceListContent />
        </SourceList>
      </TooltipProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Folder" }));
    const group = await waitFor(() => {
      const currentGroup = container.querySelector(
        "[data-slot='imported-sources-folders'] button[aria-expanded]",
      );

      expect(currentGroup).toBeInTheDocument();
      return currentGroup;
    });

    expect(group).toBeInTheDocument();
    act(() => store.dispatch(editingInstanceClosed("source-1")));

    expect(group).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("source-1")).not.toBeInTheDocument());
    expect(
      container.querySelector("[data-slot='imported-sources-folders'] button[aria-expanded]"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("source-2")).toBeInTheDocument();
  });
});
