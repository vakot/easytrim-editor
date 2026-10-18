import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  prepareSourcePreview: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (original) => ({
  ...(await original<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

vi.mock("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, row: never) => ReactNode;
  }) => (
    <div role="list">
      {data.map((row, index) => (
        <div key={index}>{itemContent(index, row as never)}</div>
      ))}
    </div>
  ),
}));

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { applyHistoryPosition } from "@/app/store/integration/workspace-history";
import {
  editingInstanceDuplicated,
  editingInstancesAdded,
  editingInstanceSnapshotUpdated,
} from "@/app/store/slices/editing-instances-slice";
import {
  historyOperationRecorded,
  selectWorkspaceHistory,
} from "@/app/store/slices/workspace-history-slice";
import { createAppStore } from "@/app/store/store";
import {
  closeEditingInstancesRequested,
  navigateToEditingInstance,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance, SourceAvailability } from "@/domain/editing-instance";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

import { WorkspaceHistory } from "../WorkspaceHistory";

beforeEach(() => {
  vi.resetAllMocks();
  native.activateSourcePath.mockImplementation(async (sourcePath: string) => ({
    sourcePath,
    displayName: sourcePath.split("/").at(-1)!,
  }));
  native.inspectMedia.mockImplementation(async (sourcePath: string) => media(sourcePath));
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    mediaToken: 1,
    url: "media://source",
  });
});

async function setup(availability: SourceAvailability = "available") {
  const store = createAppStore();
  store.dispatch(
    editingInstancesAdded(
      ["a", "b", "c"].map((id): EditingInstance => {
        const source = id === "b" ? secondSource : firstSource;
        return {
          id,
          origin: "source-import",
          exportAttempts: [],
          media: media(source.sourcePath),
          snapshot: createDefaultEditorSnapshot(source),
          sourceAvailability: id === "b" ? "available" : availability,
        };
      }),
    ),
  );
  expect(await store.dispatch(navigateToEditingInstance("b"))).toBe(true);
  return store;
}

describe("WorkspaceHistory destination navigation", () => {
  it("preserves the resolved active instance when a lifecycle entry adds another available instance", async () => {
    const user = userEvent.setup();
    const store = await setup();
    store.dispatch(
      editingInstanceDuplicated({
        ...store.getState().editingInstances.entities.a!,
        id: "duplicate",
        origin: "duplicate",
        exportAttempts: [],
      }),
    );
    render(
      <Provider store={store}>
        <WorkspaceHistory />
      </Provider>,
    );
    await user.click(await screen.findByRole("button", { name: /Switch source/ }));
    await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(1));
    expect(store.getState().editingInstances.entities.duplicate).toBeUndefined();
    native.activateSourcePath.mockClear();

    await user.click(
      screen.getByRole("button", { name: /Duplicate editing instance.*Available to redo/ }),
    );
    await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(2));
    expect(store.getState().editingInstances.entities.duplicate?.id).toBe("duplicate");
    expect(store.getState().editingInstances.activeInstanceId).toBe("b");
    expect(native.activateSourcePath).not.toHaveBeenCalled();
  });

  it("can select an active-source closure and then its replacement-source navigation", async () => {
    const user = userEvent.setup();
    const store = await setup();
    await store.dispatch(navigateToEditingInstance("a"));
    await store.dispatch(closeEditingInstancesRequested(["a"]));
    await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(4));
    render(
      <Provider store={store}>
        <WorkspaceHistory />
      </Provider>,
    );
    await screen.findByRole("button", { name: /Close editing instance/ });

    await user.click(screen.getAllByRole("button", { name: /Switch source/ })[1]!);
    await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(2));
    expect(store.getState().editingInstances.activeInstanceId).toBe("a");
    native.activateSourcePath.mockClear();
    await user.click(
      screen.getByRole("button", { name: /Close editing instance.*Available to redo/ }),
    );
    await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(3));
    expect(store.getState().editingInstances.entities.a).toBeUndefined();
    expect(store.getState().editingInstances.activeInstanceId).toBeNull();
    expect(native.activateSourcePath).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Switch source.*Available to redo/ }));
    await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(4));
    expect(store.getState().editingInstances.activeInstanceId).toBe("b");
    expect(native.activateSourcePath).toHaveBeenCalledExactlyOnceWith(
      secondSource.sourcePath,
      expect.anything(),
    );
    expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(4);
  });

  it.each([
    { name: "a single closure", ids: ["a"], availability: "available" as const },
    { name: "a batch closure", ids: ["a", "c"], availability: "available" as const },
    { name: "closing every instance", ids: ["a", "b", "c"], availability: "available" as const },
    { name: "closing a missing source", ids: ["a"], availability: "missing" as const },
    {
      name: "closing a batch of missing instances",
      ids: ["a", "c"],
      availability: "missing" as const,
    },
    { name: "closing deleted instances", ids: ["a", "c"], availability: "deleted" as const },
  ])(
    "navigates to and from $name without activating a removed instance",
    async ({ availability, ids }) => {
      const user = userEvent.setup();
      const store = await setup(availability);
      await store.dispatch(closeEditingInstancesRequested(ids));
      const history = selectWorkspaceHistory(store.getState());
      expect(history.position).toBe(2);
      const remaining = ["a", "b", "c"].filter((id) => !ids.includes(id));
      const activeAfterClose = ids.includes("b") ? null : "b";
      render(
        <Provider store={store}>
          <WorkspaceHistory />
        </Provider>,
      );
      expect(
        await screen.findByRole("button", { name: /Close editing instance.*Current state/ }),
      ).toHaveTextContent("instance a");

      for (let round = 0; round < 2; round++) {
        native.activateSourcePath.mockClear();
        await user.click(screen.getByRole("button", { name: /Switch source/ }));
        await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(1));
        expect(store.getState().editingInstances.ids).toEqual(["a", "b", "c"]);
        expect(store.getState().editingInstances.activeInstanceId).toBe("b");
        expect(store.getState().editingInstances.entities.a?.sourceAvailability).toBe(availability);
        expect(native.activateSourcePath).toHaveBeenCalledTimes(activeAfterClose === null ? 1 : 0);
        for (const [path] of native.activateSourcePath.mock.calls)
          expect(path).toBe(secondSource.sourcePath);

        native.activateSourcePath.mockClear();
        const close = screen.getByRole("button", {
          name: /Close editing instance.*Available to redo/,
        });

        expect(close).toHaveTextContent("instance a");
        if (ids.includes("c")) expect(close).toHaveTextContent("instance c");
        await user.click(close);
        await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(2));
        expect(store.getState().editingInstances.ids).toEqual(remaining);
        expect(store.getState().editingInstances.activeInstanceId).toBe(activeAfterClose);
        expect(store.getState().source.source?.sourcePath ?? null).toBe(
          activeAfterClose ? secondSource.sourcePath : null,
        );
        expect(native.activateSourcePath).not.toHaveBeenCalled();
        expect(
          screen.getByRole("button", { name: /Close editing instance.*Current state/ }),
        ).toHaveAttribute("aria-current", "step");
        expect(selectWorkspaceHistory(store.getState()).operations).toEqual(history.operations);
      }
    },
  );

  it.each(["available", "missing", "deleted"] as const)(
    "focuses an edited instance only when it is %s at the destination",
    async (availability) => {
      const user = userEvent.setup();
      const store = await setup(availability);
      const instance = store.getState().editingInstances.entities.a!;
      const trim = { startMicros: 100_000, endMicros: 4_000_000 };
      store.dispatch(
        editingInstanceSnapshotUpdated({ id: "a", snapshot: { ...instance.snapshot, trim } }),
      );
      store.dispatch(
        historyOperationRecorded({
          id: "trim-a",
          label: "Adjust trim",
          timestamp: 1,
          kind: "state",
          role: "edit",
          changes: [
            {
              field: "trim",
              target: { kind: "instance", instanceId: "a", sourceId: firstSource.sourcePath },
              before: { present: true, value: { kind: "full-source" } },
              after: { present: true, value: trim },
            },
          ],
        }),
      );
      expect(await store.dispatch(applyHistoryPosition(1))).toBe(true);
      native.activateSourcePath.mockClear();
      render(
        <Provider store={store}>
          <WorkspaceHistory />
        </Provider>,
      );

      await user.click(await screen.findByRole("button", { name: /Trim.*Available to redo/ }));
      await waitFor(() => expect(selectWorkspaceHistory(store.getState()).position).toBe(2));
      expect(store.getState().editingInstances.entities.a?.snapshot.trim).toEqual(trim);
      expect(store.getState().editingInstances.entities.a?.sourceAvailability).toBe(availability);
      expect(store.getState().editingInstances.activeInstanceId).toBe(
        availability === "available" ? "a" : "b",
      );
      expect(native.activateSourcePath).toHaveBeenCalledTimes(availability === "available" ? 1 : 0);
      expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(2);
    },
  );
});
