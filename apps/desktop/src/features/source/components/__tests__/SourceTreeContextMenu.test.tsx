import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource, secondSource } from "@/test/source.fixtures";

import { SourceTreeContextMenu } from "../SourceTreeContextMenu";

function createInstance(id: string, source: typeof firstSource): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(source, false),
    sourceAvailability: "available",
  };
}

function renderContextMenu(kind: "file" | "folder", sourceIds: string[]) {
  const store = createAppStore();
  store.dispatch(
    editingInstancesAdded(
      sourceIds.map((id, index) =>
        createInstance(id, index % 2 === 0 ? firstSource : secondSource),
      ),
    ),
  );

  render(
    <Provider store={store}>
      <SourceTreeContextMenu kind={kind} revealPath="C:/Media" sourceIds={sourceIds}>
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
});
