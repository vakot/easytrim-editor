import { retainWorkspaceHistory } from "./workspace-history-retention";

export type HistoryValue =
  null | boolean | number | string | HistoryValue[] | { [key: string]: HistoryValue };
export type HistoryTarget =
  | { kind: "workspace" }
  | { kind: "source"; sourceId: string }
  | { instanceId: string; kind: "instance"; sourceId: string };
export type HistorySlot = { present: false } | { present: true; value: HistoryValue };
export interface HistoryChange {
  after: HistorySlot;
  before: HistorySlot;
  field: string;
  target: HistoryTarget;
}
export interface HistoryMetadata {
  id: string;
  label: string;
  timestamp: number;
}
export type HistoryOperation = HistoryMetadata &
  (
    | { changes: HistoryChange[]; kind: "state"; role: "edit" | "navigation" }
    | { affected: HistoryTarget[]; kind: "external"; payload: HistoryValue; type: string }
    | { affected: HistoryTarget[]; kind: "information"; payload: HistoryValue }
  );
export interface HistoryData {
  operations: HistoryOperation[];
  position: number;
  version: 1;
}
export interface HistoryStep {
  direction: "undo" | "redo";
  operation: Exclude<HistoryOperation, { kind: "information" }>;
}
export interface HistoryTransition {
  from: number;
  steps: HistoryStep[];
  to: number;
}

// Strict JSON cloning rejects values that JSON.stringify would silently discard or coerce.
function copy<T>(input: T): T {
  const ancestors = new Set<object>();
  function check(value: unknown): void {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object" || value === null || ancestors.has(value))
      throw new Error("History requires finite JSON values");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
      throw new Error("History requires plain JSON objects");
    if (Object.getOwnPropertySymbols(value).length)
      throw new Error("History cannot contain symbol keys");
    ancestors.add(value);
    for (const item of Array.isArray(value) ? Array.from(value) : Object.values(value)) check(item);
    ancestors.delete(value);
  }
  check(input);
  return JSON.parse(JSON.stringify(input)) as T;
}
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left),
    b = Object.keys(right);

  return (
    a.length === b.length &&
    a.every(
      (key) =>
        Object.hasOwn(right, key) &&
        equal((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
}

/** Compare explicitly projected durable fields, never the complete runtime/store state. */
export function identifyHistoryChanges(
  target: HistoryTarget,
  before: Record<string, HistoryValue>,
  after: Record<string, HistoryValue>,
): HistoryChange[] {
  copy({ target, before, after });
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((field) => {
    const previous: HistorySlot = Object.hasOwn(before, field)
      ? { present: true, value: before[field]! }
      : { present: false };

    const next: HistorySlot = Object.hasOwn(after, field)
      ? { present: true, value: after[field]! }
      : { present: false };

    return equal(previous, next) ? [] : [copy({ target, field, before: previous, after: next })];
  });
}

function normalize(operation: HistoryOperation): HistoryOperation {
  const result = copy(operation);
  if (
    typeof result.id !== "string" ||
    !result.id ||
    typeof result.label !== "string" ||
    !result.label.trim() ||
    !Number.isFinite(result.timestamp)
  )
    throw new Error("Invalid history metadata");
  function target(value: HistoryTarget): void {
    if (value.kind === "workspace") return;
    if (
      (value.kind !== "source" && value.kind !== "instance") ||
      typeof value.sourceId !== "string" ||
      !value.sourceId ||
      (value.kind === "instance" && (typeof value.instanceId !== "string" || !value.instanceId))
    )
      throw new Error("Invalid history identity");
  }
  if (result.kind === "state") {
    if (result.role !== "edit" && result.role !== "navigation")
      throw new Error("Invalid history role");
    const changes: HistoryChange[] = [];
    for (const change of result.changes) {
      target(change.target);
      if (
        typeof change.field !== "string" ||
        !change.field ||
        typeof change.before.present !== "boolean" ||
        typeof change.after.present !== "boolean" ||
        (change.before.present && !Object.hasOwn(change.before, "value")) ||
        (change.after.present && !Object.hasOwn(change.after, "value"))
      )
        throw new Error("Invalid history change");
      const existing = changes.find(
        (item) => equal(item.target, change.target) && item.field === change.field,
      );

      if (existing) {
        if (!equal(existing.after, change.before)) throw new Error("Discontinuous grouped change");
        existing.after = change.after;
      } else changes.push(change);
    }
    result.changes = changes.filter((change) => !equal(change.before, change.after));
  } else if (result.kind === "external" || result.kind === "information") {
    result.affected.forEach(target);
    if (
      !Object.hasOwn(result, "payload") ||
      (result.kind === "external" && (typeof result.type !== "string" || !result.type))
    )
      throw new Error("Invalid history payload");
  } else throw new Error("Invalid history operation");
  return result;
}

/** One coordinator per workspace. Runtime callbacks and open groups are never serialized. */
export class WorkspaceHistory {
  private data: HistoryData = { version: 1, operations: [], position: 0 };
  private group:
    (HistoryMetadata & { changes: HistoryChange[]; role: "edit" | "navigation" }) | null = null;
  private navigating = false;

  constructor(restored?: unknown) {
    if (restored === undefined) return;
    const data = copy(restored) as HistoryData;
    if (
      data.version !== 1 ||
      !Array.isArray(data.operations) ||
      !Number.isInteger(data.position) ||
      data.position < 0 ||
      data.position > data.operations.length
    )
      throw new Error("Invalid history document");
    const ids = new Set<string>();
    data.operations = data.operations.map((operation) => {
      const normalized = normalize(operation);
      if (ids.has(normalized.id) || (normalized.kind === "state" && !normalized.changes.length))
        throw new Error("Invalid stored operation");
      ids.add(normalized.id);
      return normalized;
    });
    this.data = retainWorkspaceHistory(data);
  }

  snapshot(): HistoryData {
    return copy(this.data);
  }

  record(operation: HistoryOperation): boolean {
    if (this.navigating) return false;
    if (this.group) throw new Error("Finish the open operation first");
    const normalized = normalize(operation);
    if (normalized.kind === "state" && !normalized.changes.length) return false;
    if (this.data.operations.some((item) => item.id === normalized.id))
      throw new Error("Duplicate history ID");
    this.data.operations = [...this.data.operations.slice(0, this.data.position), normalized];
    this.data.position = this.data.operations.length;
    this.data = retainWorkspaceHistory(this.data);
    return true;
  }

  begin(metadata: HistoryMetadata, role: "edit" | "navigation" = "edit"): void {
    if (this.navigating || this.group) throw new Error("History is busy");
    normalize({ ...metadata, role, kind: "state", changes: [] });
    this.group = { ...copy(metadata), role, changes: [] };
  }

  capture(
    target: HistoryTarget,
    before: Record<string, HistoryValue>,
    after: Record<string, HistoryValue>,
  ): void {
    if (this.navigating) return;
    if (!this.group) throw new Error("Begin an operation before capture");
    const operation = normalize({
      ...this.group,
      kind: "state",
      changes: [...this.group.changes, ...identifyHistoryChanges(target, before, after)],
    });

    if (operation.kind === "state") this.group.changes = operation.changes;
  }

  end(): boolean {
    if (this.navigating || !this.group) throw new Error("No open operation");
    const group = this.group;
    this.group = null;
    try {
      return this.record({ ...group, kind: "state" });
    } catch (error) {
      this.group = group;
      throw error;
    }
  }

  undo(apply: (transition: HistoryTransition) => boolean | Promise<boolean>): Promise<boolean> {
    let index = this.data.position - 1;
    while (index >= 0 && !meaningful(this.data.operations[index]!)) index--;
    return this.goTo(index < 0 ? this.data.position : index, apply);
  }

  redo(apply: (transition: HistoryTransition) => boolean | Promise<boolean>): Promise<boolean> {
    let index = this.data.position;
    while (index < this.data.operations.length && !meaningful(this.data.operations[index]!))
      index++;
    return this.goTo(index === this.data.operations.length ? this.data.position : index + 1, apply);
  }

  async goTo(
    position: number,
    apply: (transition: HistoryTransition) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    if (this.navigating || this.group) throw new Error("History is busy");
    if (!Number.isInteger(position) || position < 0 || position > this.data.operations.length)
      throw new Error("Invalid history position");
    const from = this.data.position;
    if (position === from) return false;
    const direction = position < from ? "undo" : "redo";
    const operations = this.data.operations.slice(
      Math.min(from, position),
      Math.max(from, position),
    );

    if (direction === "undo") operations.reverse();
    const steps: HistoryStep[] = operations.flatMap((operation) =>
      operation.kind === "information" ? [] : [{ direction, operation }],
    );

    this.navigating = true;
    try {
      const accepted = await apply(copy({ from, to: position, steps }));
      if (accepted !== true) return false;
      this.data.position = position;
      return true;
    } finally {
      this.navigating = false;
    }
  }
}
function meaningful(operation: HistoryOperation): boolean {
  return operation.kind === "external" || (operation.kind === "state" && operation.role === "edit");
}
