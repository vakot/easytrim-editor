import { describe, expect, it } from "vitest";

import { type HistoryData, type HistoryOperation, WorkspaceHistory } from "../workspace-history";
import {
  HISTORY_MAX_OPERATIONS,
  HISTORY_MAX_SERIALIZED_LENGTH,
  retainWorkspaceHistory,
} from "../workspace-history-retention";

function edit(index: number): HistoryOperation {
  return {
    id: `edit-${index}`,
    label: "Edit",
    timestamp: index,
    kind: "state",
    role: "edit",
    changes: [
      {
        target: { kind: "instance", instanceId: "instance", sourceId: "source" },
        field: "rotation",
        before: { present: true, value: index },
        after: { present: true, value: index + 1 },
      },
    ],
  };
}

describe("workspace history retention", () => {
  it.each([HISTORY_MAX_OPERATIONS + 3, 100, 0])(
    "retains valid replay around cursor %i without changing the workspace",
    async (position) => {
      const total = HISTORY_MAX_OPERATIONS + 3;
      let workspace = position;
      const history = new WorkspaceHistory({
        version: 1,
        operations: Array.from({ length: total }, (_, index) => edit(index)),
        position,
      });

      const retained = history.snapshot();
      const removed = Math.min(position, 3);
      expect(workspace).toBe(position);
      expect(retained.position).toBe(position - removed);
      expect(retained.operations).toHaveLength(HISTORY_MAX_OPERATIONS);
      expect(retained.operations[0]?.id).toBe(`edit-${removed}`);
      const apply: Parameters<WorkspaceHistory["goTo"]>[1] = (transition) => {
        for (const { direction, operation } of transition.steps) {
          if (operation.kind !== "state") return false;
          const change = operation.changes[0]!;
          const expected = direction === "undo" ? change.after : change.before;
          const next = direction === "undo" ? change.before : change.after;
          expect(expected.present && expected.value).toBe(workspace);
          if (next.present) workspace = next.value as number;
        }
        return true;
      };

      if (retained.position > 0) expect(await history.goTo(0, apply)).toBe(true);
      expect(workspace).toBe(removed);
      expect(await history.goTo(retained.operations.length, apply)).toBe(true);
      expect(workspace).toBe(removed + HISTORY_MAX_OPERATIONS);
      const restored = new WorkspaceHistory(JSON.parse(JSON.stringify(history.snapshot())));
      expect(restored.snapshot()).toEqual(history.snapshot());
    },
  );

  it("bounds newly recorded history and invalidates Redo before retaining a new branch", async () => {
    const history = new WorkspaceHistory();
    for (let index = 0; index < HISTORY_MAX_OPERATIONS + 3; index++) history.record(edit(index));
    expect(history.snapshot().position).toBe(HISTORY_MAX_OPERATIONS);
    expect(history.snapshot().operations[0]?.id).toBe("edit-3");
    await history.goTo(2, () => true);
    history.record(edit(999));
    expect(history.snapshot().operations.map(({ id }) => id)).toEqual([
      "edit-3",
      "edit-4",
      "edit-999",
    ]);
    expect(history.snapshot().position).toBe(3);
  });

  it.each([3, 1, 0])(
    "bounds large lifecycle payloads at cursor %i without retaining gaps",
    (position) => {
      const operations: HistoryOperation[] = Array.from({ length: 3 }, (_, index) => ({
        id: `lifecycle-${index}`,
        label: "Close instances",
        timestamp: index,
        kind: "external",
        type: "instances.lifecycle",
        affected: [],
        payload: { snapshots: "界".repeat(150_000) },
      }));

      const data: HistoryData = { version: 1, position, operations };
      const retained = retainWorkspaceHistory(data);
      expect(JSON.stringify(retained).length).toBeLessThanOrEqual(HISTORY_MAX_SERIALIZED_LENGTH);
      expect(retained.operations).toHaveLength(1);
      expect(retained.position).toBe(position === 3 ? 1 : 0);
      expect(retained.operations[0]?.id).toBe(`lifecycle-${position === 3 ? 2 : position}`);
      expect(data.position).toBe(position);
      expect(data.operations).toHaveLength(3);
    },
  );

  it("makes an oversized atomic operation the new baseline instead of keeping a partial entry", () => {
    const operation: HistoryOperation = {
      id: "huge",
      label: "Import",
      timestamp: 0,
      kind: "external",
      type: "instances.lifecycle",
      affected: [],
      payload: "x".repeat(HISTORY_MAX_SERIALIZED_LENGTH),
    };

    const history = new WorkspaceHistory();
    expect(history.record(operation)).toBe(true);
    expect(history.snapshot()).toEqual({ version: 1, operations: [], position: 0 });
    history.record(edit(1));
    expect(history.snapshot().operations.map(({ id }) => id)).toEqual(["edit-1"]);
  });
});
