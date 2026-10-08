import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstancesAdded,
  selectSourceListEntries,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstanceListEntry } from "@/domain/editing-instance";
import { firstSource, secondSource } from "@/test/source.fixtures";

const virtuosoHarness = vi.hoisted(() => ({
  props: null as null | {
    components: {
      ScrollSeekPlaceholder: (props: { height: number; index: number; type: "item" }) => ReactNode;
    };
    computeItemKey: (index: number, source: EditingInstanceListEntry) => string;
    customScrollParent: HTMLElement;
    data: EditingInstanceListEntry[];
    increaseViewportBy: { bottom: number; top: number };
    itemContent: (index: number, source: EditingInstanceListEntry) => ReactNode;
    rangeChanged: (range: { endIndex: number; startIndex: number }) => void;
    scrollerRef: (element: HTMLElement | Window | null) => void;
    scrollSeekConfiguration: {
      change: (velocity: number, range: { endIndex: number; startIndex: number }) => void;
    };
  },
}));

const thumbnailActions = vi.hoisted(() => ({
  prepare: vi.fn<(sourceIds: string[]) => void>(),
  release: vi.fn<(sourceId: string) => void>(),
}));

vi.mock("react-virtuoso", async () => {
  const React = await import("react");
  return {
    Virtuoso: (props: NonNullable<typeof virtuosoHarness.props>) => {
      const [scrollSeeking, setScrollSeeking] = React.useState(false);
      const { data, rangeChanged } = props;
      virtuosoHarness.props = props;
      React.useEffect(() => {
        rangeChanged({ endIndex: Math.min(2, data.length - 1), startIndex: 0 });
      }, [data, rangeChanged]);

      const visibleSources = data.slice(0, 3);
      return (
        <div data-count={data.length} data-testid="virtuoso">
          <button
            onClick={() => {
              const range = { endIndex: 10, startIndex: 8 };
              props.scrollSeekConfiguration.change(1200, range);
              setScrollSeeking(true);
            }}
            type="button"
          >
            Mock enter scroll seek
          </button>
          <button
            onClick={() => {
              const range = { endIndex: 10, startIndex: 8 };
              setScrollSeeking(false);
              props.rangeChanged(range);
              props.customScrollParent.scrollTop += 1;
              props.customScrollParent.dispatchEvent(new Event("scroll"));
            }}
            type="button"
          >
            Mock finish scroll seek
          </button>
          {visibleSources.map((source, index) => (
            <React.Fragment key={props.computeItemKey(index, source)}>
              {scrollSeeking
                ? props.components.ScrollSeekPlaceholder({ height: 112, index, type: "item" })
                : props.itemContent(index, source)}
            </React.Fragment>
          ))}
        </div>
      );
    },
  };
});

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>();
  return {
    ...actual,
    prepareImportedSourceThumbnailsRequested: (sources: EditingInstanceListEntry[]) => {
      const sourceIds = sources.map(({ id }) => id);
      thumbnailActions.prepare(sourceIds);
      return { payload: sourceIds, type: "test/thumbnailDemandPrepared" };
    },
    releaseImportedSourceThumbnailDemand: (sourceId: string) => {
      thumbnailActions.release(sourceId);
      return { payload: sourceId, type: "test/thumbnailDemandReleased" };
    },
  };
});

import { SourceList, SourceListCloseAll, SourceListContent, SourceListSearch } from "../SourceList";

vi.mock("../../SourceCard", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    SourceCard: ({ children, source }: PropsWithChildren<{ source: EditingInstanceListEntry }>) => (
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

describe("source queue controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    thumbnailActions.prepare.mockClear();
    thumbnailActions.release.mockClear();
    virtuosoHarness.props = null;
  });

  it("renders file, folder, and drag-and-drop actions when no sources are imported", () => {
    render(
      <Provider store={createAppStore()}>
        <SourceList />
      </Provider>,
    );

    expect(screen.getByRole("region", { name: "Source explorer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open File/ })).toHaveTextContent("CtrlO");
    expect(screen.getByRole("button", { name: /Open Folder/ })).toHaveTextContent("CtrlK");
    expect(screen.getByText("Drag and drop videos here")).toBeInTheDocument();
    expect(screen.getByText("MP4 · MOV · MKV · WebM · AVI")).toBeInTheDocument();
  });

  it("focuses source search with Ctrl+F and shows its shortcut hint", () => {
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    store.dispatch(
      editingInstancesAdded([
        {
          id: "source",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListSearch />
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    const search = screen.getByRole("searchbox", { name: "Search sources" });
    expect(search).toHaveAttribute("placeholder", "Search sources…");
    expect(screen.getByLabelText("Source search keyboard shortcut: Ctrl + F")).toBeInTheDocument();

    fireEvent.keyDown(window, { code: "KeyF", ctrlKey: true });

    expect(document.activeElement).toBe(search);
  });

  it("leaves the browser find shortcut available while search is focused", () => {
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    store.dispatch(
      editingInstancesAdded([
        {
          id: "source",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListSearch />
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    const search = screen.getByRole("searchbox", { name: "Search sources" });
    search.focus();
    const event = createEvent.keyDown(search, { code: "KeyF", ctrlKey: true });

    fireEvent(search, event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("clears the search with the Lucide clear action", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    store.dispatch(
      editingInstancesAdded([
        {
          id: "source",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListSearch />
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    const search = screen.getByRole("searchbox", { name: "Search sources" });
    await user.type(search, "sample");
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(search).toHaveValue("");
    expect(
      await screen.findByLabelText("Source search keyboard shortcut: Ctrl + F"),
    ).toBeInTheDocument();
  });

  it("closes all imported sources from the source list action", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded(
        [firstSource, secondSource].map((source, index) => ({
          id: `source-${index}`,
          origin: "source-import" as const,
          snapshot: createDefaultEditorSnapshot(source, false),
          sourceAvailability: "available" as const,
          exportAttempts: [],
        })),
      ),
    );

    render(
      <TooltipProvider>
        <Provider store={store}>
          <SourceList>
            {() => (
              <>
                <SourceListCloseAll />
                <SourceListContent />
              </>
            )}
          </SourceList>
        </Provider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Close all open sources" }));
    expect(selectSourceListEntries(store.getState())).toHaveLength(2);

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(selectSourceListEntries(store.getState())).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Close all open sources" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close" }),
    );

    await waitFor(() => expect(selectSourceListEntries(store.getState())).toHaveLength(0));
  });

  it("passes the full filtered dataset with stable source ID keys", () => {
    const store = createAppStore();
    const sources = Array.from({ length: 1_400 }, (_, index) => ({
      displayName: `clip-${index}.mp4`,
      sourcePath: `C:/Media/clip-${index}.mp4`,
    }));

    store.dispatch(
      editingInstancesAdded(
        sources.map((source, index) => ({
          id: `source-${index}`,
          origin: "source-import" as const,
          snapshot: createDefaultEditorSnapshot(source, false),
          sourceAvailability: "available" as const,
          exportAttempts: [],
        })),
      ),
    );

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    expect(virtuosoHarness.props?.data).toHaveLength(1_400);
    expect(virtuosoHarness.props?.data).toBe(selectSourceListEntries(store.getState()));
    expect(virtuosoHarness.props?.computeItemKey(1399, virtuosoHarness.props.data[1399]!)).toBe(
      "source-1399",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByTestId("virtuoso")).toHaveAttribute("data-count", "1400");
    expect(virtuosoHarness.props?.increaseViewportBy).toEqual({ bottom: 600, top: 600 });
    expect(virtuosoHarness.props?.customScrollParent).toBe(
      document.querySelector('[data-slot="scroll-area-viewport"]'),
    );
  });

  it("updates virtualized data when search changes and shows the no-results state", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded(
        [firstSource, secondSource].map((source, index) => ({
          id: `source-${index}`,
          origin: "source-import" as const,
          snapshot: createDefaultEditorSnapshot(source, false),
          sourceAvailability: "available" as const,
          exportAttempts: [],
        })),
      ),
    );

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListSearch />
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search sources" }), "second");
    await waitFor(() => {
      expect(virtuosoHarness.props?.data.map(({ id }) => id)).toEqual(["source-1"]);
    });

    await user.clear(screen.getByRole("searchbox", { name: "Search sources" }));
    await user.type(screen.getByRole("searchbox", { name: "Search sources" }), "missing file");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("No imported sources match your search");
    });
    expect(screen.queryByTestId("virtuoso")).not.toBeInTheDocument();
  });

  it("moves thumbnail demand with the virtualized range and releases it on unmount", () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded(
        [firstSource, secondSource].map((source, index) => ({
          id: `source-${index}`,
          origin: "source-import" as const,
          snapshot: createDefaultEditorSnapshot(source, false),
          sourceAvailability: "available" as const,
          exportAttempts: [],
        })),
      ),
    );

    const view = render(
      <Provider store={store}>
        <SourceList>
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    expect(thumbnailActions.prepare).toHaveBeenCalledWith(["source-0", "source-1"]);
    virtuosoHarness.props?.rangeChanged({ endIndex: 0, startIndex: 0 });
    expect(thumbnailActions.release).toHaveBeenCalledWith("source-1");
    virtuosoHarness.props?.rangeChanged({ endIndex: 1, startIndex: 1 });
    expect(thumbnailActions.prepare).toHaveBeenLastCalledWith(["source-1"]);
    expect(thumbnailActions.release).toHaveBeenCalledWith("source-0");

    view.unmount();
    expect(thumbnailActions.release).toHaveBeenCalledWith("source-1");
  });

  it("releases stale demand after filtering and suppresses thumbnail work during scroll seek", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    const sources = Array.from({ length: 12 }, (_, index) => ({
      displayName: `clip-${index}.mp4`,
      sourcePath: `C:/Media/clip-${index}.mp4`,
    }));

    store.dispatch(
      editingInstancesAdded(
        sources.map((source, index) => ({
          id: `source-${index}`,
          origin: "source-import" as const,
          snapshot: createDefaultEditorSnapshot(source, false),
          sourceAvailability: "available" as const,
          exportAttempts: [],
        })),
      ),
    );

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListSearch />
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search sources" }), "clip-0");
    await waitFor(() => expect(thumbnailActions.release).toHaveBeenCalledWith("source-1"));

    await user.clear(screen.getByRole("searchbox", { name: "Search sources" }));
    await waitFor(() => expect(virtuosoHarness.props?.data).toHaveLength(12));
    thumbnailActions.prepare.mockClear();
    await user.click(screen.getByRole("button", { name: "Mock enter scroll seek" }));
    expect(document.querySelectorAll('[role="presentation"]')).toHaveLength(3);
    expect(screen.queryByTestId("source-0")).not.toBeInTheDocument();
    virtuosoHarness.props?.rangeChanged({ endIndex: 10, startIndex: 8 });
    expect(thumbnailActions.prepare).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Mock finish scroll seek" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    await waitFor(() => {
      expect(thumbnailActions.prepare).toHaveBeenCalledWith(["source-8", "source-9", "source-10"]);
    });
  });
});
