import { describe, expect, it, vi } from "vitest";

import {
  type HistoryOperation,
  type HistoryTarget,
  identifyHistoryChanges,
  WorkspaceHistory,
} from "../workspace-history";

const target: Extract<HistoryTarget, { kind: "instance" }> = {
  kind: "instance",
  sourceId: "file",
  instanceId: "a",
};

const metadata = (id: string) => ({ id, label: `Edit ${id}`, timestamp: 100 });
function edit(id: string, instanceId = "a"): HistoryOperation {
  return {
    ...metadata(id),
    kind: "state",
    role: "edit",
    changes: identifyHistoryChanges({ ...target, instanceId }, { start: 0 }, { start: 1 }),
  };
}
describe("WorkspaceHistory", () => {
  it("replays atomic field values across instances without touching unrelated state", async () => {
    const history = new WorkspaceHistory();
    const state: Record<string, Record<string, unknown>> = {
      a: { start: 1, end: 9, runtime: "untouched" },
      b: { start: 2, end: 8 },
    };

    history.begin(metadata("combined"));
    history.capture(target, { start: 0, end: 10 }, { start: 1, end: 9 });
    history.capture({ ...target, instanceId: "b" }, { start: 0, end: 10 }, { start: 2, end: 8 });
    history.end();
    const apply = (plan: import("../workspace-history").HistoryTransition) => {
      const next = structuredClone(state);
      for (const step of plan.steps) {
        if (step.operation.kind !== "state") return false;
        for (const change of step.operation.changes) {
          if (change.target.kind !== "instance") return false;
          const fields = next[change.target.instanceId]!;
          const expected = step.direction === "undo" ? change.after : change.before;
          const replacement = step.direction === "undo" ? change.before : change.after;
          if (
            expected.present !== Object.hasOwn(fields, change.field) ||
            (expected.present && fields[change.field] !== expected.value)
          )
            return false;
          if (replacement.present) fields[change.field] = replacement.value;
          else delete fields[change.field];
        }
      }
      Object.assign(state, next);
      return true;
    };

    expect(await history.undo(apply)).toBe(true);
    expect(state).toEqual({
      a: { start: 0, end: 10, runtime: "untouched" },
      b: { start: 0, end: 10 },
    });
    const noOp: HistoryOperation = {
      ...metadata("noop"),
      kind: "state",
      role: "edit",
      changes: [],
    };

    expect(history.record(noOp)).toBe(false);
    expect(await history.redo(apply)).toBe(true);
    expect(state.a).toEqual({ start: 1, end: 9, runtime: "untouched" });
    state.b!.start = 99;
    const previous = structuredClone(state);
    expect(await history.undo(apply)).toBe(false);
    expect(state).toEqual(previous);
    expect(history.snapshot().position).toBe(1);
  });

  it("captures only changed fields, including absence, and ignores structural no-ops", () => {
    const changes = identifyHistoryChanges(
      target,
      { unchanged: { a: 1, b: 2 }, removed: null, start: 0 },
      { unchanged: { b: 2, a: 1 }, added: null, start: 2 },
    );

    expect(changes.map((change) => change.field)).toEqual(["removed", "start", "added"]);
    expect(changes[0]!.after).toEqual({ present: false });
    const history = new WorkspaceHistory();
    expect(history.record({ ...metadata("noop"), kind: "state", role: "edit", changes: [] })).toBe(
      false,
    );
    expect(history.snapshot().position).toBe(0);
  });
  it("groups multi-field and multi-instance changes atomically, retaining first and last values", async () => {
    const history = new WorkspaceHistory();
    history.begin(metadata("drag"));
    history.capture(target, { start: 0, end: 10 }, { start: 1, end: 9 });
    history.capture(target, { start: 1 }, { start: 2 });
    history.capture({ ...target, instanceId: "b" }, { start: 0 }, { start: 3 });
    expect(history.snapshot().operations).toEqual([]);
    await expect(history.undo(() => true)).rejects.toThrow("busy");
    expect(history.end()).toBe(true);
    const operation = history.snapshot().operations[0]!;
    expect(operation.kind === "state" && operation.changes).toHaveLength(3);
    expect(operation.kind === "state" && operation.changes[0]!.before).toEqual({
      present: true,
      value: 0,
    });
    expect(operation.kind === "state" && operation.changes[0]!.after).toEqual({
      present: true,
      value: 2,
    });
    history.begin(metadata("return"));
    history.capture(target, { start: 2 }, { start: 4 });
    history.capture(target, { start: 4 }, { start: 2 });
    expect(history.end()).toBe(false);
    history.begin(metadata("next"));
    history.capture(target, { start: 2 }, { start: 5 });
    history.end();
    expect(history.snapshot().operations).toHaveLength(2);
  });
  it("navigates the global timeline in order and invalidates redo after an edit", async () => {
    const history = new WorkspaceHistory();
    history.record(edit("one"));
    history.record(edit("two", "b"));
    history.record(edit("three"));
    const apply = vi.fn(() => true);
    await history.goTo(0, apply);
    expect(apply.mock.calls[0]).toBeDefined();
    await history.redo(apply);
    expect(history.snapshot().position).toBe(1);
    await history.redo(apply);
    await history.undo(apply);
    history.record(edit("branch"));
    expect(history.snapshot().operations.map((operation) => operation.id)).toEqual([
      "one",
      "branch",
    ]);
    expect(await history.redo(apply)).toBe(false);
  });
  it("skips navigation and information for ordinary undo while retaining direct positions", async () => {
    const history = new WorkspaceHistory();
    history.record(edit("edit"));
    history.record({
      ...edit("switch"),
      kind: "state",
      role: "navigation",
      changes: identifyHistoryChanges({ kind: "workspace" }, { active: "a" }, { active: "b" }),
    });
    history.record({
      ...metadata("info"),
      kind: "information",
      affected: [target],
      payload: "Imported",
    });
    await history.undo((plan) => {
      expect(plan.steps.map((step) => step.operation.id)).toEqual(["switch", "edit"]);
      expect(plan.steps.every((step) => step.direction === "undo")).toBe(true);
      return true;
    });
    expect(history.snapshot().position).toBe(0);
    await history.redo(() => true);
    expect(history.snapshot().position).toBe(1);
    await history.goTo(3, () => true);
    expect(history.snapshot().position).toBe(3);
  });
  it("does not advance on rejection or exceptions and suppresses recording during async replay", async () => {
    const history = new WorkspaceHistory();
    history.record({
      ...metadata("external"),
      kind: "external",
      type: "source.restore",
      affected: [target],
      payload: { token: "opaque" },
    });
    expect(await history.undo(() => false)).toBe(false);
    await expect(
      history.undo(() => {
        throw new Error("unavailable");
      }),
    ).rejects.toThrow("unavailable");
    expect(history.snapshot().position).toBe(1);
    let finish!: (value: boolean) => void;
    const pending = history.undo(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );

    expect(history.record(edit("replay"))).toBe(false);
    expect(() => history.begin(metadata("blocked"))).toThrow("busy");
    await expect(history.goTo(0, () => true)).rejects.toThrow("busy");
    finish(true);
    await pending;
    expect(history.snapshot().position).toBe(0);
    expect(history.snapshot().operations).toHaveLength(1);
  });
  it("round-trips cursor, identities, values and redo without sharing mutable references", async () => {
    const history = new WorkspaceHistory();
    const operation = edit("one");
    history.record(operation);
    history.record(edit("two", "b"));
    operation.label = "mutated";
    await history.undo(() => true);
    const serialized = JSON.stringify(history.snapshot());
    const restored = new WorkspaceHistory(JSON.parse(serialized));
    expect(restored.snapshot()).toEqual(history.snapshot());
    restored.snapshot().operations.pop();
    expect(restored.snapshot().operations).toHaveLength(2);
    expect(await restored.redo(() => true)).toBe(true);
  });
  it("isolates runtime resources by explicit projection and rejects non-JSON values", () => {
    const history = new WorkspaceHistory();
    const runtime = { trim: 1, buffer: new Uint8Array(20), callback: () => true, cache: new Map() };
    history.begin(metadata("projection"));
    runtime.buffer[0] = 5;
    history.capture(target, { trim: runtime.trim }, { trim: runtime.trim });
    expect(history.end()).toBe(false);
    for (const value of [
      undefined,
      NaN,
      Infinity,
      new Date(),
      new Map(),
      () => true,
      new Uint8Array(2),
    ]) {
      expect(() => identifyHistoryChanges(target, {}, { invalid: value } as never)).toThrow();
    }
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => identifyHistoryChanges(target, {}, cycle as never)).toThrow();
  });
  it("rejects invalid restoration, duplicate IDs and discontinuous groups without changing history", async () => {
    const history = new WorkspaceHistory();
    history.record(edit("one"));
    expect(() => history.record(edit("one"))).toThrow("Duplicate");
    for (const invalid of [
      { version: 2, operations: [], position: 0 },
      { version: 1, operations: [], position: 1 },
      { version: 1, operations: [edit("one"), edit("one")], position: 0 },
    ])
      expect(() => new WorkspaceHistory(invalid)).toThrow();
    await expect(history.goTo(-1, () => true)).rejects.toThrow();
    history.begin(metadata("group"));
    history.capture(target, { start: 1 }, { start: 2 });
    expect(() => history.capture(target, { start: 99 }, { start: 3 })).toThrow("Discontinuous");
    expect(history.end()).toBe(true);
  });
});
