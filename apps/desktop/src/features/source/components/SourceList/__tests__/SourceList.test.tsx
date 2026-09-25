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

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { enqueueExport } from "@/app/store/integration/export-queue-runtime";
import {
  editingInstanceClosed,
  editingInstanceExportAttemptQueued,
  editingInstanceExportCompleted,
  editingInstanceExportStarted,
  editingInstancesAdded,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceQueueStarted } from "@/app/store/slices/export-slice";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";
import { importedThumbnailLoading } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource, secondSource } from "@/test/source.fixtures";

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
    SourceCard: ({ children, source }: PropsWithChildren<{ source: EditingInstance }>) => (
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
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(container.querySelector("[style*='height:']")).toBeNull();
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
