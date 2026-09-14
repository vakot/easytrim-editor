import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareImportedSourceThumbnail = vi.hoisted(() =>
  vi.fn(async (sourcePath: string) => ({
    mediaToken: 1,
    url: `http://easytrim-media.localhost/${encodeURIComponent(sourcePath)}?variant=thumbnail`,
  })),
);

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  prepareImportedSourceThumbnail,
}));

beforeEach(() => {
  prepareImportedSourceThumbnail.mockClear();
});

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
  selectActiveInstanceId,
} from "@/app/store/slices/editing-instances-slice";
import { importedThumbnailReady } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import { ImportedSources } from "../ImportedSources";

function instance(
  id: string,
  displayName: string,
  sourcePath = `C:/Media/${displayName}`,
): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot({ displayName, sourcePath }, false),
    sourceAvailability: "available",
  };
}

describe("ImportedSources", () => {
  it("renders imported source cards and filters by filename or path", () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "holiday.mp4"),
        instance("second", "screen-recording.mp4"),
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("first"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/screen-recording.mp4")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="imported-sources-grid"]')).toBeInTheDocument();

    expect(document.querySelector('[data-source-id="first"]')).toHaveAttribute(
      "data-variant",
      "default",
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "recording" },
    });

    expect(screen.queryByText("holiday.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("screen-recording.mp4")).toBeInTheDocument();
  });

  it("groups sources by folder and provides folder actions", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "first.mp4", "C:/Media/First/first.mp4"),
        instance("second", "second.mp4", "C:/Media/First/second.mp4"),
        instance("third", "third.mp4", "C:/Media/Second/third.mp4"),
      ]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(document.querySelectorAll("[data-source-folder]")).toHaveLength(2);
    expect(screen.getByText("C:/Media/First")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/Second")).toBeInTheDocument();

    const firstFolderTrigger = screen.getByRole("button", { name: "C:/Media/First" });
    expect(firstFolderTrigger).toHaveClass("group");
    await user.click(firstFolderTrigger);
    expect(screen.queryByText("first.mp4")).not.toBeInTheDocument();

    await user.click(firstFolderTrigger);
    await user.click(screen.getByRole("button", { name: "Folder actions: C:/Media/First" }));

    expect(screen.getByRole("menuitem", { name: "Close folder" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete folder" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(
      screen.getByRole("menuitem", { name: /Reveal in (File Manager|File Explorer|Finder)/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Delete folder" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete folder?")).toBeInTheDocument();
  });

  it("opens on plain click and merges modifier selections", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "first.mp4"),
        instance("second", "second.mp4"),
        instance("third", "third.mp4"),
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("first"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    await user.click(cards[0]!);
    expect(cards[0]).toHaveAttribute("aria-checked", "true");
    expect(cards[1]).toHaveAttribute("aria-checked", "false");
    expect(selectActiveInstanceId(store.getState())).toBe("first");

    fireEvent.click(cards[1]!, { ctrlKey: true });
    expect(cards[0]).toHaveAttribute("aria-checked", "true");
    expect(cards[1]).toHaveAttribute("aria-checked", "true");
    expect(cards[2]).toHaveAttribute("aria-checked", "false");
    expect(selectActiveInstanceId(store.getState())).toBe("first");

    fireEvent.click(cards[2]!, { shiftKey: true });
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card).toHaveAttribute("aria-checked", "true");
    expect(selectActiveInstanceId(store.getState())).toBe("first");

    fireEvent.click(cards[2]!, { shiftKey: true });
    expect(cards[0]).toHaveAttribute("aria-checked", "true");
    expect(cards[1]).toHaveAttribute("aria-checked", "true");
    expect(cards[2]).toHaveAttribute("aria-checked", "false");

    expect(selectActiveInstanceId(store.getState())).toBe("first");

    await user.click(cards[1]!);
    expect(cards[0]).toHaveAttribute("aria-checked", "false");
    expect(cards[1]).toHaveAttribute("aria-checked", "true");
    expect(selectActiveInstanceId(store.getState())).toBe("second");
  });

  it("starts a Shift range from the active source and updates its anchor after Shift", () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "first.mp4"),
        instance("second", "second.mp4"),
        instance("third", "third.mp4"),
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("second"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    expect(cards[0]).toHaveAttribute("aria-checked", "false");
    expect(cards[1]).toHaveAttribute("aria-checked", "true");
    expect(cards[2]).toHaveAttribute("aria-checked", "false");

    fireEvent.click(cards[2]!, { shiftKey: true });
    fireEvent.click(cards[2]!, { shiftKey: true });

    expect(cards[0]).toHaveAttribute("aria-checked", "false");
    expect(cards[1]).toHaveAttribute("aria-checked", "true");
    expect(cards[2]).toHaveAttribute("aria-checked", "false");
    expect(selectActiveInstanceId(store.getState())).toBe("second");
  });

  it("does not allow the active source to be deselected", () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "first.mp4"),
        instance("second", "second.mp4"),
        instance("third", "third.mp4"),
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("second"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    fireEvent.click(cards[1]!, { ctrlKey: true });
    expect(cards[1]).toHaveAttribute("aria-checked", "true");

    fireEvent.click(cards[0]!, { shiftKey: true });
    fireEvent.click(cards[0]!, { shiftKey: true });
    expect(cards[0]).toHaveAttribute("aria-checked", "false");
    expect(cards[1]).toHaveAttribute("aria-checked", "true");
  });

  it("keeps the last clicked anchor after a range is deselected", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "first.mp4"),
        instance("second", "second.mp4"),
        instance("third", "third.mp4"),
      ]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    await user.click(cards[0]!);
    fireEvent.click(cards[0]!, { shiftKey: true });
    fireEvent.click(cards[2]!, { shiftKey: true });

    for (const card of cards) expect(card).toHaveAttribute("aria-checked", "true");
  });

  it("shows bulk close and delete actions without reveal", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([instance("first", "first.mp4"), instance("second", "second.mp4")]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    await user.click(cards[0]!);
    expect(screen.queryByRole("button", { name: /Source actions: 2/ })).not.toBeInTheDocument();
    fireEvent.click(cards[1]!, { ctrlKey: true });

    await user.click(screen.getByRole("button", { name: "Source actions: 2" }));

    expect(screen.getByRole("menuitem", { name: "Close File" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete File" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Reveal in/ })).not.toBeInTheDocument();
  });

  it("shows plural context actions for the selected cards", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([instance("first", "first.mp4"), instance("second", "second.mp4")]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    await user.click(cards[0]!);
    fireEvent.click(cards[1]!, { ctrlKey: true });
    fireEvent.contextMenu(cards[0]!);

    expect(screen.getByRole("menuitem", { name: "Close Files (2)" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete Files (2)" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Reveal in/ }));
    expect(screen.getByRole("menuitem", { name: "first.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "second.mp4" })).toBeInTheDocument();
  });

  it("shows individual context actions for a non-selected card", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([instance("first", "first.mp4"), instance("second", "second.mp4")]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    const cards = screen.getAllByRole("checkbox");
    await user.click(cards[0]!);
    fireEvent.contextMenu(cards[1]!);

    expect(cards[0]).toHaveAttribute("aria-checked", "true");
    expect(cards[1]).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitem", { name: "Close File" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete File" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Reveal in (File Manager|File Explorer|Finder)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Close Files (2)" })).not.toBeInTheDocument();
  });

  it("restores the source explorer empty view when no sources are open", () => {
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByText("Choose a single video file to start editing.")).toBeInTheDocument();
    expect(screen.getByText("Drag and drop videos here")).toBeInTheDocument();
    expect(screen.getByText("MP4 · MOV · MKV · WebM · AVI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open File/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Folder/ })).toBeInTheDocument();
  });

  it("uses the asynchronously retained thumbnail for each source", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("first", "holiday.mp4")]));
    store.dispatch(
      importedThumbnailReady({
        instanceId: "first",
        thumbnail: {
          mediaToken: 1,
          url: "http://easytrim-media.localhost/9223372036854775809?variant=thumbnail",
        },
      }),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByLabelText("holiday.mp4 thumbnail")).toHaveAttribute(
      "src",
      "http://easytrim-media.localhost/9223372036854775809?variant=thumbnail",
    );
  });

  it("requests and displays a thumbnail for every imported source", async () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "holiday.mp4"),
        instance("second", "screen-recording.mp4"),
      ]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    await waitFor(() => expect(prepareImportedSourceThumbnail).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByLabelText("holiday.mp4 thumbnail")).toHaveAttribute(
        "src",
        "http://easytrim-media.localhost/C%3A%2FMedia%2Fholiday.mp4?variant=thumbnail",
      );
      expect(screen.getByLabelText("screen-recording.mp4 thumbnail")).toHaveAttribute(
        "src",
        "http://easytrim-media.localhost/C%3A%2FMedia%2Fscreen-recording.mp4?variant=thumbnail",
      );
    });
  });
});
