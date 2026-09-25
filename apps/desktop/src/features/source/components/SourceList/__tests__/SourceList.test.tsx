import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openFileLocation = vi.hoisted(() => vi.fn());
const prepareThumbnails = vi.hoisted(() => vi.fn());
const releaseThumbnails = vi.hoisted(() => vi.fn());
const cardRenderCounts = vi.hoisted(() => new Map<string, number>());

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  openFileLocation,
}));

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>()),
  prepareImportedSourceThumbnailsRequested: prepareThumbnails,
  releaseImportedSourceThumbnailDemand: releaseThumbnails,
}));

import { TooltipProvider } from "@/components/ui/tooltip";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceReady } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { enqueueExport } from "@/app/store/integration/export-queue-runtime";
import {
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstanceExportAttemptQueued,
  editingInstanceExportCompleted,
  editingInstanceExportStarted,
  editingInstancesAdded,
  selectImportedEditingInstances,
  selectSourceSearchEntries,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceQueueStarted } from "@/app/store/slices/export-slice";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";
import { importedThumbnailLoading } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

import * as sourceSearchUtils from "../../../lib/source-search.utils";
import { SourceDeleteProvider } from "../../../SourceDeleteProvider";
import {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListSearch,
  SourceListTabs,
} from "../SourceList";

const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalOffsetHeight)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  if (originalOffsetWidth)
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
});

class VirtualListResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  disconnect() {}

  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 900, height: 600 } } as ResizeObserverEntry],
      this,
    );
  }

  unobserve() {}
}

function createSourceInstances(count: number): EditingInstance[] {
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

vi.mock("../../SourceCard", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    SourceCard: ({ children, source }: PropsWithChildren<{ source: EditingInstance }>) => {
      cardRenderCounts.set(source.id, (cardRenderCounts.get(source.id) ?? 0) + 1);
      return <div data-testid={source.id}>{children}</div>;
    },
    SourceCardActions: Container,
    SourceCardDescription: () => null,
    SourceCardMetadata: () => null,
    SourceCardStatusBadge: () => null,
    SourceCardThumbnail: Container,
    SourceCardTitle: () => null,
  };
});

describe("source queue controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", VirtualListResizeObserver);
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return this.matches("[data-slot='scroll-area-viewport'], [data-slot='tabs-content']")
          ? 600
          : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return this.matches("[data-slot='scroll-area-viewport'], [data-slot='tabs-content']")
          ? 900
          : 0;
      },
    });
    cardRenderCounts.clear();
    prepareThumbnails.mockReturnValue({ type: "test/thumbnail" });
    releaseThumbnails.mockReturnValue({ type: "test/release-thumbnail" });
  });

  it("renders a bounded virtual range with full-list scroll height", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createSourceInstances(1400)));

    const { container } = render(
      <div data-slot="scroll-area-viewport" style={{ height: 500, overflow: "auto" }}>
        <Provider store={store}>
          <SourceDeleteProvider>
            <SourceList />
          </SourceDeleteProvider>
        </Provider>
      </div>,
    );

    expect(container.querySelector("[data-slot='virtual-list']")).toHaveStyle({
      height: `${1400 * 72}px`,
    });
    expect(container.querySelectorAll("[data-virtual-index]").length).toBeLessThan(30);
    expect(screen.getByTestId("source-0")).toBeInTheDocument();
    expect(screen.queryByTestId("source-1399")).not.toBeInTheDocument();
    expect(prepareThumbnails).toHaveBeenCalled();
  });

  it("renders the destination range after a fast scrollbar jump", async () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createSourceInstances(1400)));
    const { container } = render(
      <div data-slot="scroll-area-viewport" style={{ height: 500, overflow: "auto" }}>
        <Provider store={store}>
          <SourceList />
        </Provider>
      </div>,
    );

    const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) throw new Error("Expected scroll viewport");

    act(() => {
      viewport.scrollTop = 72 * 1000;
      fireEvent.scroll(viewport);
    });

    expect(await screen.findByTestId("source-1000")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-virtual-index]").length).toBeLessThan(30);
    expect(releaseThumbnails).toHaveBeenCalledWith("source-0");
    expect(screen.getByTestId("source-1000").closest("[data-entering]")).toBeNull();
  });

  it("animates a newly added source once without animating initial or virtual mounts", async () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createSourceInstances(2)));
    render(
      <div data-slot="scroll-area-viewport" style={{ height: 500, overflow: "auto" }}>
        <Provider store={store}>
          <SourceList />
        </Provider>
      </div>,
    );
    expect(screen.getByTestId("source-0").closest("[data-entering]")).toBeNull();

    act(() => {
      store.dispatch(
        editingInstancesAdded(
          createSourceInstances(1).map((source) => ({ ...source, id: "source-new" })),
        ),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("source-new").closest("[data-entering]")).toHaveAttribute(
        "data-entering",
        "true",
      ),
    );
  });

  it("keeps a large loaded list stable during activation, status changes, and removal", async () => {
    vi.stubGlobal("scrollTo", vi.fn());
    const searcherSpy = vi.spyOn(sourceSearchUtils, "createSourceSearcher");
    const store = createAppStore();
    const instances = createSourceInstances(1400);
    store.dispatch(editingInstancesAdded(instances));

    const { container } = render(
      <div data-slot="scroll-area-viewport" style={{ height: 500, overflow: "auto" }}>
        <Provider store={store}>
          <SourceList />
        </Provider>
      </div>,
    );

    const visibleIds = [...cardRenderCounts.keys()];
    expect(visibleIds.length).toBeLessThan(30);

    const initialSearcherCalls = searcherSpy.mock.calls.length;
    const initialRenderCounts = new Map(cardRenderCounts);
    const initialSearchEntries = selectSourceSearchEntries(store.getState());
    expect(initialSearcherCalls).toBe(1);
    expect(container.querySelectorAll("[layout]")).toHaveLength(0);
    expect(
      [...container.querySelectorAll<HTMLElement>("[data-virtual-index]")].every(
        (row) => row.style.height === "72px",
      ),
    ).toBe(true);

    act(() => store.dispatch(activeEditingInstanceChanged("source-5")));
    expect(searcherSpy).toHaveBeenCalledTimes(initialSearcherCalls);
    for (const id of visibleIds) {
      if (id !== "source-5") expect(cardRenderCounts.get(id)).toBe(initialRenderCounts.get(id));
    }
    const countsAfterActivation = new Map(cardRenderCounts);

    act(() => {
      const selectedSource = instances[5]!.snapshot.source;
      const selectedMedia = media(selectedSource.sourcePath);
      store.dispatch(
        editingInstanceActivated({
          id: "source-5",
          loadToken: 2,
          media: selectedMedia,
          snapshot: instances[5]!.snapshot,
        }),
      );
      store.dispatch(sourceReady({ loadToken: 2, media: selectedMedia }));
    });
    expect(selectSourceSearchEntries(store.getState())).toBe(initialSearchEntries);
    expect(searcherSpy).toHaveBeenCalledTimes(initialSearcherCalls);
    expect(
      [...container.querySelectorAll<HTMLElement>("[data-virtual-index]")].every(
        (row) => row.style.height === "72px",
      ),
    ).toBe(true);
    for (const id of visibleIds) {
      if (id !== "source-5") expect(cardRenderCounts.get(id)).toBe(countsAfterActivation.get(id));
    }
    const countsAfterReady = new Map(cardRenderCounts);

    act(() => store.dispatch(editingInstanceClosed("source-0")));
    expect(screen.queryByTestId("source-0")).not.toBeInTheDocument();
    expect(searcherSpy).toHaveBeenCalledTimes(initialSearcherCalls + 1);
    expect(cardRenderCounts.get("source-1")).toBe(countsAfterReady.get("source-1"));
    expect(container.querySelectorAll("[layout]")).toHaveLength(0);
  });

  it("keeps virtual rows fixed-height and animates an explicit source close", async () => {
    const store = createAppStore();
    const instances = createSourceInstances(2);
    store.dispatch(editingInstancesAdded(instances));

    const { container } = render(
      <div data-slot="scroll-area-viewport" style={{ height: 400, overflow: "auto" }}>
        <Provider store={store}>
          <SourceDeleteProvider>
            <SourceList />
          </SourceDeleteProvider>
        </Provider>
      </div>,
    );

    const card = screen.getByTestId("source-0");
    const row = card.closest<HTMLElement>("[data-virtual-index]");
    if (!row) throw new Error("Expected the source list item");
    const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) throw new Error("Expected the SourceList scroll viewport");
    expect(row).toHaveStyle({ height: "72px" });

    const user = userEvent.setup();
    await user.click(within(row).getByRole("button", { name: /Source actions/ }));
    await user.click(screen.getByRole("button", { name: "Close File" }));

    expect(card).toBeInTheDocument();
    expect(card.closest("[data-exiting]")).toHaveAttribute("data-exiting", "true");
    expect(row).toHaveStyle({ height: "72px" });
    expect(viewport.scrollTop).toBe(0);
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

    const search = screen.getByRole("searchbox", { name: "Search" });
    expect(screen.getByLabelText("Ctrl + F")).toBeInTheDocument();

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

    const search = screen.getByRole("searchbox", { name: "Search" });
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

    const search = screen.getByRole("searchbox", { name: "Search" });
    await user.type(search, "sample");
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(search).toHaveValue("");
    expect(await screen.findByLabelText("Ctrl + F")).toBeInTheDocument();
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
    expect(selectImportedEditingInstances(store.getState())).toHaveLength(2);

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(selectImportedEditingInstances(store.getState())).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Close all open sources" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close" }),
    );

    expect(selectImportedEditingInstances(store.getState())).toHaveLength(0);
  });

  it("closes every source in a grouped source list action", async () => {
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
                <SourceListTabs />
                <SourceListContent />
              </>
            )}
          </SourceList>
        </Provider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "Folder" }));
    expect(
      [...document.querySelectorAll<HTMLElement>("[data-virtual-index]")].some(
        (row) => row.style.height === "36px",
      ),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Close group" }));
    expect(selectImportedEditingInstances(store.getState())).toHaveLength(2);
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close" }),
    );

    expect(selectImportedEditingInstances(store.getState())).toHaveLength(0);
  });

  it("starts and cancels only the chosen source without removing pending attempts", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    for (const id of ["a", "b"]) {
      store.dispatch(
        editingInstancesAdded([
          {
            id,
            origin: "source-import",
            snapshot,
            sourceAvailability: "available",
            exportAttempts: [],
          },
        ]),
      );
      store.dispatch(importedThumbnailLoading({ instanceId: id }));
      store.dispatch(
        editingInstanceExportAttemptQueued({
          id,
          attempt: createExportAttempt({
            id: `export-${id}`,
            capturedAt: 1,
            snapshot,
            route: "fast",
            request: {
              sourcePath: firstSource.sourcePath,
              trim: { startMicros: 0, endMicros: 1_000_000 },
              audioTracks: [],
              mergeAudio: false,
              rotationDegrees: 0,
            },
            output: { outputId: id, displayName: `${id}.mp4`, displayPath: `C:/Exports/${id}.mp4` },
          }),
        }),
      );
    }
    render(
      <Provider store={store}>
        <SourceDeleteProvider>
          <SourceList />
        </SourceDeleteProvider>
      </Provider>,
    );
    const sourceA = within(screen.getByTestId("a").closest("[data-virtual-index]")!);
    const sourceB = within(screen.getByTestId("b").closest("[data-virtual-index]")!);
    await user.click(sourceB.getByRole("button", { name: "Start queue" }));
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(true);
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(false);
    expect(sourceA.getByRole("button", { name: "Start queue" })).toBeEnabled();
    await user.click(sourceB.getByRole("button", { name: "Cancel" }));
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(false);
    expect(sourceB.getByRole("button", { name: "Start queue" })).toBeEnabled();
    expect(store.getState().editingInstances.entities.b?.exportAttempts[0]?.state.status).toBe(
      "queued",
    );
  });

  it("cancels an individual queued export", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      id: "export-first",
      capturedAt: 1,
      snapshot,
      route: "fast",
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 0, endMicros: 1_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
      },
      output: { outputId: "first", displayName: "first.mp4", displayPath: "C:/Exports/first.mp4" },
    });

    store.dispatch(
      editingInstancesAdded([
        {
          id: "first",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );
    store.dispatch(importedThumbnailLoading({ instanceId: "first" }));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "first", attempt }));
    enqueueExport("first", attempt, store.dispatch, store.getState);

    render(
      <Provider store={store}>
        <SourceDeleteProvider>
          <SourceList />
        </SourceDeleteProvider>
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: /Source actions/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.getState().editingInstances.entities.first?.exportAttempts[0]?.state.status).toBe(
      "canceled",
    );
  });

  it("reveals the output for a completed export", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      id: "export-first",
      capturedAt: 1,
      snapshot,
      route: "fast",
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 0, endMicros: 1_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
      },
      output: { outputId: "first", displayName: "first.mp4", displayPath: "C:/Exports/first.mp4" },
    });

    store.dispatch(
      editingInstancesAdded([
        {
          id: "first",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );
    store.dispatch(importedThumbnailLoading({ instanceId: "first" }));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "first", attempt }));
    store.dispatch(
      editingInstanceExportStarted({ attemptId: attempt.id, id: "first", startedAt: 2 }),
    );
    store.dispatch(
      editingInstanceExportCompleted({
        attemptId: attempt.id,
        durationMs: 1,
        id: "first",
        result: {
          displayName: "first.mp4",
          displayPath: "C:/Exports/first.mp4",
          operationId: "operation-1",
        },
      }),
    );

    render(
      <Provider store={store}>
        <SourceDeleteProvider>
          <SourceList />
        </SourceDeleteProvider>
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: /Source actions/ }));
    await user.click(screen.getAllByRole("button", { name: /Reveal in/ })[0]!);
    expect(openFileLocation).toHaveBeenCalledWith("C:/Exports/first.mp4");
  });
});
