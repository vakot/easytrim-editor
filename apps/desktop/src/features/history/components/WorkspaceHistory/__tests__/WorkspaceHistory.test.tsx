import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoryActivationTarget } from "@/app/store/integration/workspace-history-resolution";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    editingInstances: {
      entities: {
        instanceA: {
          snapshot: {
            source: { displayName: "First source.mp4", sourcePath: "C:/media/first.mp4" },
          },
        },
        instanceB: {
          snapshot: {
            source: { displayName: "First source.mp4", sourcePath: "C:/media/first.mp4" },
          },
        },
      },
    },
    workspaceHistory: {
      interaction: null as unknown,
      operations: [] as unknown[],
      position: 0,
      replaying: false,
    },
  },
}));

vi.mock("@/app/store/redux-hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) => selector(mocks.state),
}));

vi.mock("@/app/store/integration/workspace-history", () => ({
  applyHistoryPosition: (
    position: number,
    includeNavigation: boolean,
    activationTarget?: HistoryActivationTarget,
  ) => ({
    payload: { includeNavigation, activationTarget, position },
    type: "workspaceHistory/navigateRequested",
  }),
}));

vi.mock("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, item: never) => ReactNode;
  }) => (
    <div role="list">
      {data.map((item, index) => (
        <div key={index}>{itemContent(index, item as never)}</div>
      ))}
    </div>
  ),
}));

import { WorkspaceHistory } from "../WorkspaceHistory";

const target = {
  instanceId: "instanceA",
  kind: "instance",
  sourceId: "C:/media/first.mp4",
};

function editOperation(id: string, field: string, instanceId: string, timestamp: number) {
  return {
    changes: [
      {
        after: { present: true, value: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } },
        before: { present: true, value: null },
        field,
        target: { ...target, instanceId },
      },
    ],
    id,
    kind: "state",
    label: `Adjust ${field}`,
    role: "edit",
    timestamp,
  };
}

function setHistory(operations: unknown[], position: number) {
  mocks.state.workspaceHistory.operations = operations;
  mocks.state.workspaceHistory.position = position;
  mocks.state.workspaceHistory.replaying = false;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.editingInstances.entities.instanceA.snapshot.source.displayName = "First source.mp4";
  mocks.state.workspaceHistory.operations = [];
  mocks.state.workspaceHistory.interaction = null;
  mocks.state.workspaceHistory.position = 0;
  mocks.state.workspaceHistory.replaying = false;
});

describe("WorkspaceHistory", () => {
  it("shows chronological operations, source and instance attribution, and applied/current/redo states", async () => {
    const user = userEvent.setup();
    setHistory(
      [
        editOperation("trim-1", "trim", "instanceA", 1_700_000_000_000),
        {
          changes: [
            {
              after: { present: true, value: "instanceB" },
              before: { present: true, value: "instanceA" },
              field: "activeInstanceId",
              target: { kind: "workspace" },
            },
          ],
          id: "switch-1",
          kind: "state",
          label: "Switch editing instance",
          role: "navigation",
          timestamp: 1_700_000_001_000,
        },
        editOperation("crop-1", "crop", "instanceB", 1_700_000_002_000),
      ],
      2,
    );

    render(<WorkspaceHistory />);

    const list = await screen.findByRole("list");
    const entries = within(list).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("Beginning");
    expect(entries[1]).toHaveTextContent("Trim");
    expect(entries[1]).toHaveTextContent("First source.mp4 · instance instanceA");
    expect(entries[2]).toHaveTextContent("Switch source");
    expect(entries[3]).toHaveTextContent("Crop");
    expect(entries[3]).toHaveTextContent("First source.mp4 · instance instanceB");
    expect(
      screen.getByRole("button", { name: /Trim.*First source\.mp4.*Applied/ }),
    ).toHaveAttribute("data-history-state", "applied");
    expect(screen.getByRole("button", { name: /Switch source.*Current state/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: /Crop.*Available to redo/ })).toHaveAttribute(
      "data-history-state",
      "redo",
    );

    await user.click(screen.getByRole("button", { name: /Crop.*Available to redo/ }));
    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: {
        includeNavigation: true,
        activationTarget: { preferredInstanceId: "instanceB" },
        position: 3,
      },
      type: "workspaceHistory/navigateRequested",
    });
  });

  it("navigates to the beginning and updates the active state when Undo/Redo move the cursor", async () => {
    const user = userEvent.setup();
    const operations = [
      editOperation("trim-1", "trim", "instanceA", 1_700_000_000_000),
      editOperation("crop-1", "crop", "instanceA", 1_700_000_001_000),
    ];

    setHistory(operations, 2);
    const view = render(<WorkspaceHistory />);

    const beginning = await screen.findByRole("button", { name: /Beginning.*Applied/ });
    await user.click(beginning);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: { includeNavigation: true, activationTarget: undefined, position: 0 },
      type: "workspaceHistory/navigateRequested",
    });

    setHistory(operations, 1);
    view.rerender(<WorkspaceHistory />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Trim.*Current state/ })).toHaveAttribute(
        "aria-current",
        "step",
      ),
    );
    expect(screen.getByRole("button", { name: /Crop.*Available to redo/ })).toBeInTheDocument();
  });

  it("drops the redo branch after a new operation is recorded", async () => {
    const operations = [
      editOperation("trim-1", "trim", "instanceA", 1_700_000_000_000),
      editOperation("crop-1", "crop", "instanceA", 1_700_000_001_000),
    ];

    setHistory(operations, 1);
    const view = render(<WorkspaceHistory />);

    expect(
      await screen.findByRole("button", { name: /Crop.*Available to redo/ }),
    ).toBeInTheDocument();
    setHistory(
      [operations[0], editOperation("flip-1", "flipHorizontal", "instanceA", 1_700_000_002_000)],
      2,
    );
    view.rerender(<WorkspaceHistory />);

    expect(
      screen.queryByRole("button", { name: /Crop.*Available to redo/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Flip.*Current state/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("keeps navigation disabled while history is replaying", async () => {
    const operations = [editOperation("trim-1", "trim", "instanceA", 1_700_000_000_000)];
    setHistory(operations, 0);
    mocks.state.workspaceHistory.replaying = true;
    render(<WorkspaceHistory />);
    const redo = await screen.findByRole("button", { name: /Trim.*Available to redo/ });

    fireEvent.click(redo);
    expect(redo).toBeDisabled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("keeps navigation disabled while an edit interaction is still open", async () => {
    setHistory([editOperation("trim-1", "trim", "instanceA", 1_700_000_000_000)], 0);
    mocks.state.workspaceHistory.interaction = { id: "drag-1" };
    render(<WorkspaceHistory />);

    expect(await screen.findByRole("button", { name: /Trim.*Available to redo/ })).toBeDisabled();
  });
});
