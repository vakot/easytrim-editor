import { describe, expect, it } from "vitest";

import type { HistoryOperation } from "@/domain/workspace-history";
import { HISTORY_MAX_OPERATIONS } from "@/domain/workspace-history-retention";

import {
  historyChangesCaptured,
  historyInteractionEnded,
  historyInteractionStarted,
  historyOperationRecorded,
  workspaceHistoryReducer,
  workspaceHistoryRestored,
} from "../workspace-history-slice";

function operation(index: number): Extract<HistoryOperation, { kind: "state" }> {
  return {
    id: `edit-${index}`,
    label: "Adjust trim",
    timestamp: index * 1000,
    kind: "state",
    role: "edit",
    changes: [
      {
        target: { kind: "instance", instanceId: "instance", sourceId: "source" },
        field: "trim",
        before: { present: true, value: index },
        after: { present: true, value: index + 1 },
      },
    ],
  };
}

describe("workspace history slice retention", () => {
  it.each(["record", "capture", "group"])("bounds completed operations from %s", (mode) => {
    let state = workspaceHistoryReducer(undefined, { type: "init" });
    for (let index = 0; index <= HISTORY_MAX_OPERATIONS; index++) {
      const entry = operation(index);
      const metadata = { id: entry.id, label: entry.label, timestamp: entry.timestamp };
      if (mode === "record")
        state = workspaceHistoryReducer(state, historyOperationRecorded(entry));
      else {
        if (mode === "group")
          state = workspaceHistoryReducer(state, historyInteractionStarted(metadata));
        state = workspaceHistoryReducer(
          state,
          historyChangesCaptured({ changes: entry.changes, metadata }),
        );
        if (mode === "group") state = workspaceHistoryReducer(state, historyInteractionEnded());
      }
    }
    expect(state.operations).toHaveLength(HISTORY_MAX_OPERATIONS);
    expect(state.position).toBe(HISTORY_MAX_OPERATIONS);
    expect(state.operations[0]?.id).toBe("edit-1");
    expect(state.interaction).toBeNull();
  });

  it("adjusts an earlier restored cursor while preserving both sides of its retained chain", () => {
    const state = workspaceHistoryReducer(
      undefined,
      workspaceHistoryRestored({
        version: 1,
        position: 100,
        operations: Array.from({ length: HISTORY_MAX_OPERATIONS + 3 }, (_, index) =>
          operation(index),
        ),
      }),
    );

    expect(state.position).toBe(97);
    expect(state.operations).toHaveLength(HISTORY_MAX_OPERATIONS);
    expect(state.operations[96]?.id).toBe("edit-99");
    expect(state.operations[97]?.id).toBe("edit-100");
  });
});
