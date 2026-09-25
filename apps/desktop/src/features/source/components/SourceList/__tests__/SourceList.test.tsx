import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstancesAdded,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource, secondSource } from "@/test/source.fixtures";

import { SourceList, SourceListCloseAll, SourceListContent, SourceListSearch } from "../SourceList";

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
});
