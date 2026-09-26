import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
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
    expect(selectSourceListEntries(store.getState())).toHaveLength(2);

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(selectSourceListEntries(store.getState())).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Close all open sources" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close" }),
    );

    expect(selectSourceListEntries(store.getState())).toHaveLength(0);
  });

  it("uses one near-viewport observer to request and release thumbnail demand", () => {
    type ObserverRecord = {
      callback: IntersectionObserverCallback;
      observed: Element[];
      rootMargin?: string;
      trigger: (element: Element, isIntersecting: boolean) => void;
    };
    const observers: ObserverRecord[] = [];
    class FakeIntersectionObserver {
      readonly observed: Element[] = [];
      readonly rootMargin = "600px 0px";

      constructor(readonly callback: IntersectionObserverCallback) {
        observers.push(this);
      }

      observe(element: Element) {
        this.observed.push(element);
      }

      unobserve(element: Element) {
        const index = this.observed.indexOf(element);
        if (index !== -1) this.observed.splice(index, 1);
      }

      disconnect() {
        this.observed.length = 0;
      }

      trigger(element: Element, isIntersecting: boolean) {
        this.callback(
          [{ isIntersecting, target: element } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        {
          id: "source",
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource, false),
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );
    const dispatchSpy = vi.spyOn(store, "dispatch");

    render(
      <Provider store={store}>
        <SourceList>
          <SourceListContent />
        </SourceList>
      </Provider>,
    );

    expect(observers).toHaveLength(1);
    expect(observers[0]?.rootMargin).toBe("600px 0px");
    const cardElement = screen.getByTestId("source");
    const row = cardElement.parentElement;
    if (!row) throw new Error("Expected source row");
    expect(observers[0]?.observed).toContain(row);

    observers[0]?.trigger(row, true);
    observers[0]?.trigger(row, false);
    expect(dispatchSpy.mock.calls.filter(([action]) => typeof action === "function")).toHaveLength(
      2,
    );
  });
});
