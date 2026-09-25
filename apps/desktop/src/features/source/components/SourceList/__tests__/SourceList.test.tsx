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
  editingInstanceSnapshotUpdated,
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

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  readonly root: Element | Document | null;
  readonly rootMargin: string;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? "0px";
    TestIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }

  trigger(target: Element, isIntersecting = true) {
    this.callback(
      [{ isIntersecting, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

afterEach(() => {
  TestIntersectionObserver.instances = [];
  vi.unstubAllGlobals();
});

function installIntersectionObserver() {
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
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
    cardRenderCounts.clear();
    prepareThumbnails.mockReturnValue({ type: "test/thumbnail" });
    releaseThumbnails.mockReturnValue({ type: "test/release-thumbnail" });
  });

  it("appends a page when the sentinel approaches without waiting for thumbnails", async () => {
    installIntersectionObserver();
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createSourceInstances(25)));

    const { container } = render(
      <Provider store={store}>
        <SourceList />
      </Provider>,
    );

    expect(screen.getByTestId("source-11")).toBeInTheDocument();
    expect(screen.queryByTestId("source-12")).not.toBeInTheDocument();
    const sentinel = container.querySelector("[data-slot='infinite-scroll-trigger']");
    expect(sentinel).toBeInTheDocument();

    const observer = TestIntersectionObserver.instances.find((candidate) =>
      candidate.observed.has(sentinel!),
    );

    observer?.trigger(sentinel!);

    expect(await screen.findByTestId("source-12")).toBeInTheDocument();
    expect(screen.queryByTestId("source-24")).not.toBeInTheDocument();
    expect(prepareThumbnails).not.toHaveBeenCalled();
  });

  it("requests and releases thumbnail demand as a card enters and leaves the near-viewport range", () => {
    installIntersectionObserver();
    const store = createAppStore();
    const [instance] = createSourceInstances(1);
    if (!instance) throw new Error("Expected source fixture");
    store.dispatch(editingInstancesAdded([instance]));

    const { container, unmount } = render(
      <div data-slot="scroll-area-viewport">
        <Provider store={store}>
          <SourceList />
        </Provider>
      </div>,
    );

    const card = screen.getByTestId(instance.id);
    const row = card.closest("li");
    if (!row) throw new Error("Expected a SourceList item");
    const observer = TestIntersectionObserver.instances.find((candidate) =>
      candidate.observed.has(row),
    );

    expect(observer?.root).toBe(container.querySelector("[data-slot='scroll-area-viewport']"));
    expect(observer?.rootMargin).toBe("600px 0px");
    expect(prepareThumbnails).not.toHaveBeenCalled();

    observer?.trigger(row);
    expect(prepareThumbnails).toHaveBeenCalledWith([instance]);

    observer?.trigger(row, false);
    expect(releaseThumbnails).toHaveBeenCalledWith(instance.id);

    observer?.trigger(row);
    expect(prepareThumbnails).toHaveBeenCalledTimes(2);

    unmount();
    expect(releaseThumbnails).toHaveBeenCalledTimes(2);
  });

  it("does not recreate thumbnail demand observation for unrelated editor state", () => {
    installIntersectionObserver();
    const store = createAppStore();
    const [instance] = createSourceInstances(1);
    if (!instance) throw new Error("Expected source fixture");
    store.dispatch(editingInstancesAdded([instance]));

    render(
      <div data-slot="scroll-area-viewport">
        <Provider store={store}>
          <SourceList />
        </Provider>
      </div>,
    );

    const observer = TestIntersectionObserver.instances.find(
      (candidate) => candidate.observed.size,
    );

    expect(observer).toBeDefined();
    store.dispatch(
      editingInstanceSnapshotUpdated({
        id: instance.id,
        snapshot: { ...instance.snapshot, rotation: 90 },
      }),
    );

    expect(TestIntersectionObserver.instances).toHaveLength(1);
    expect(TestIntersectionObserver.instances[0]).toBe(observer);
  });

  it("renders a bounded initial page in normal document flow", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(createSourceInstances(500)));

    const { container } = render(
      <Provider store={store}>
        <SourceList />
      </Provider>,
    );

    expect(screen.getByTestId("source-11")).toBeInTheDocument();
    expect(screen.queryByTestId("source-12")).not.toBeInTheDocument();
    expect(container.querySelector("[data-index]")).toBeNull();
    expect(container.querySelector("[style*='position: absolute']")).toBeNull();
  });

  it("keeps a large loaded list stable during activation, status changes, and removal", async () => {
    vi.stubGlobal("scrollTo", vi.fn());
    installIntersectionObserver();
    const searcherSpy = vi.spyOn(sourceSearchUtils, "createSourceSearcher");
    const store = createAppStore();
    const instances = createSourceInstances(500);
    store.dispatch(editingInstancesAdded(instances));

    const { container } = render(
      <Provider store={store}>
        <SourceList />
      </Provider>,
    );

    const sentinel = container.querySelector("[data-slot='infinite-scroll-trigger']");
    if (!sentinel) throw new Error("Expected the InfiniteScroll sentinel");
    const sentinelObserver = TestIntersectionObserver.instances.find((candidate) =>
      candidate.observed.has(sentinel),
    );

    if (!sentinelObserver) throw new Error("Expected the InfiniteScroll observer");
    for (let batch = 0; batch < 50 && !screen.queryByTestId("source-499"); batch += 1) {
      act(() => {
        sentinelObserver.trigger(sentinel, false);
        sentinelObserver.trigger(sentinel);
      });
    }
    expect(screen.getByTestId("source-499")).toBeInTheDocument();
    expect(cardRenderCounts.size).toBe(500);

    const initialSearcherCalls = searcherSpy.mock.calls.length;
    const initialRenderCounts = new Map(cardRenderCounts);
    const initialSearchEntries = selectSourceSearchEntries(store.getState());
    expect(initialSearcherCalls).toBe(1);
    expect(container.querySelectorAll("[layout]")).toHaveLength(0);

    act(() => store.dispatch(activeEditingInstanceChanged("source-5")));
    expect(searcherSpy).toHaveBeenCalledTimes(initialSearcherCalls);
    for (let index = 0; index < 12; index += 1) {
      expect(cardRenderCounts.get(`source-${index}`)).toBe(
        initialRenderCounts.get(`source-${index}`),
      );
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
    for (let index = 0; index < 12; index += 1) {
      if (index !== 5) {
        expect(cardRenderCounts.get(`source-${index}`)).toBe(
          countsAfterActivation.get(`source-${index}`),
        );
      }
    }
    const countsAfterReady = new Map(cardRenderCounts);

    act(() => store.dispatch(editingInstanceClosed("source-0")));
    expect(await screen.findByTestId("source-11")).toBeInTheDocument();
    expect(searcherSpy).toHaveBeenCalledTimes(initialSearcherCalls + 1);
    for (let index = 1; index < 12; index += 1) {
      expect(
        cardRenderCounts.get(`source-${index}`),
        `source-${index} rendered after deletion`,
      ).toBe(countsAfterReady.get(`source-${index}`));
    }
    expect(container.querySelectorAll("[layout]")).toHaveLength(0);
  });

  it("keeps the source removal exit animation in the rendered list", async () => {
    const store = createAppStore();
    const instances = createSourceInstances(2);
    store.dispatch(editingInstancesAdded(instances));

    const { container } = render(
      <div data-slot="scroll-area-viewport" style={{ height: 400, overflow: "auto" }}>
        <Provider store={store}>
          <SourceList />
        </Provider>
      </div>,
    );

    const card = screen.getByTestId("source-0");
    const row = card.closest("li");
    if (!row) throw new Error("Expected the source list item");
    const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) throw new Error("Expected the SourceList scroll viewport");
    viewport.scrollTop = 240;

    act(() => store.dispatch(editingInstanceClosed(instances[0]!.id)));

    expect(card).toBeInTheDocument();
    expect(viewport.scrollTop).toBe(240);
    await waitFor(() => expect(card).not.toBeInTheDocument());
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
    const sourceA = within(screen.getByTestId("a").closest("li")!);
    const sourceB = within(screen.getByTestId("b").closest("li")!);
    await user.click(sourceB.getByRole("button", { name: "Start queue" }));
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(true);
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(false);
    expect(sourceA.getByRole("button", { name: "Start queue" })).toBeEnabled();
    await user.click(sourceB.getByText("Cancel", { selector: "button" }));
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

    await user.click(screen.getByRole("button", { name: /Reveal in/ }));
    expect(openFileLocation).toHaveBeenCalledWith("C:/Exports/first.mp4");
  });
});
