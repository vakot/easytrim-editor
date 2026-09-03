import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource, secondSource } from "@/test/source.fixtures";

import { SourceTreeContextMenu } from "../SourceTreeContextMenu";

const { openFileLocation } = vi.hoisted(() => ({
  openFileLocation: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tauri/media", () => ({ openFileLocation }));

beforeEach(() => {
  vi.clearAllMocks();
});

function createInstance(id: string, source: typeof firstSource): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(source, false),
    sourceAvailability: "available",
  };
}

function completedAttempt(id: string, displayName: string, displayPath: string) {
  const attempt = createExportAttempt({
    capturedAt: 1,
    id,
    output: { displayName, displayPath, outputId: `output-${id}` },
    request: {
      audioTracks: [],
      mergeAudio: false,
      sourcePath: firstSource.sourcePath,
      trim: { endMicros: 1_000_000, startMicros: 0 },
    },
    route: "fast",
    snapshot: createDefaultEditorSnapshot(firstSource, false),
  });

  return {
    ...attempt,
    state: {
      completedAt: 2,
      result: { displayName, displayPath, operationId: `operation-${id}` },
      status: "completed" as const,
    },
  };
}

function renderContextMenu(
  kind: "file" | "folder",
  sourceIds: string[],
  instances = sourceIds.map((id, index) =>
    createInstance(id, index % 2 === 0 ? firstSource : secondSource),
  ),
) {
  const store = createAppStore();
  store.dispatch(editingInstancesAdded(instances));

  render(
    <Provider store={store}>
      <SourceTreeContextMenu
        kind={kind}
        revealPath={
          kind === "file" ? (instances[0]?.snapshot.source.sourcePath ?? "C:/Media") : "C:/Media"
        }
        sourceIds={sourceIds}
      >
        <div data-testid="source-tree-target">Target</div>
      </SourceTreeContextMenu>
    </Provider>,
  );

  return store;
}

async function openCloseMenu() {
  fireEvent.contextMenu(screen.getByTestId("source-tree-target"), { clientX: 10, clientY: 10 });
  return screen.findByRole("menuitem", { name: "Close" });
}

async function openRevealMenu() {
  fireEvent.contextMenu(screen.getByTestId("source-tree-target"), { clientX: 10, clientY: 10 });
  return screen.findByRole("menuitem", { name: /Reveal in (File Manager|File Explorer|Finder)/ });
}

async function openRevealSubmenu(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.contextMenu(screen.getByTestId("source-tree-target"), { clientX: 10, clientY: 10 });

  const trigger = await screen.findByRole("menuitem", {
    name: /Reveal in (File Manager|File Explorer|Finder)/,
  });

  await user.hover(trigger);

  return screen.findByRole("menuitem", { name: "Source" });
}

describe("SourceTreeContextMenu", () => {
  it("requires confirmation before closing a folder batch", async () => {
    const user = userEvent.setup();
    const store = renderContextMenu("folder", ["folder-1", "folder-2"]);

    await user.click(await openCloseMenu());

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Close folder sources?" }),
    ).toBeInTheDocument();
    expect(store.getState().editingInstances.ids).toEqual(["folder-1", "folder-2"]);

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(store.getState().editingInstances.ids).toEqual([]));
  });

  it("closes a file immediately without showing the folder confirmation", async () => {
    const user = userEvent.setup();
    const store = renderContextMenu("file", ["file-1"]);

    await user.click(await openCloseMenu());

    await waitFor(() => expect(store.getState().editingInstances.ids).toEqual([]));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("reveals the source directly when the instance has no completed exports", async () => {
    const user = userEvent.setup();
    renderContextMenu("file", ["file-1"]);

    await user.click(await openRevealMenu());

    expect(openFileLocation).toHaveBeenCalledWith(firstSource.sourcePath);
  });

  it("lists the source and completed export filenames in the reveal submenu", async () => {
    const user = userEvent.setup();
    const instance = createInstance("file-1", firstSource);
    instance.exportAttempts = [
      completedAttempt("attempt-1", "first-render.mp4", "C:/Exports/first-render.mp4"),
      completedAttempt("attempt-2", "second-render.mkv", "C:/Exports/second-render.mkv"),
    ];
    renderContextMenu("file", ["file-1"], [instance]);

    await openRevealSubmenu(user);
    expect(screen.getByRole("menuitem", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "first-render.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "second-render.mkv" })).toBeInTheDocument();
    expect(screen.queryByText("C:/Exports/first-render.mp4")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "second-render.mkv" }));

    expect(openFileLocation).toHaveBeenCalledWith("C:/Exports/second-render.mkv");
  });

  it("disables the source submenu item after the source is deleted", async () => {
    const user = userEvent.setup();
    const instance = createInstance("file-1", firstSource);
    instance.sourceAvailability = "deleted";
    instance.exportAttempts = [
      completedAttempt("attempt-1", "render.mp4", "C:/Exports/render.mp4"),
    ];
    renderContextMenu("file", ["file-1"], [instance]);

    await openRevealSubmenu(user);

    expect(screen.getByRole("menuitem", { name: "Source" })).toHaveAttribute("data-disabled");
  });
});
