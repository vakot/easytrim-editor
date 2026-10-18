import {
  createEditorSnapshotFromState,
  historyProjection,
} from "@/app/store/integration/editor-snapshot";
import type { RootState } from "@/app/store/store";
import type { AudioTrackSettings } from "@/domain/audio-processing";
import type { EditingInstance, SourceAvailability } from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeSourceKey } from "@/domain/source";
import type { HistoryChange, HistorySlot } from "@/domain/workspace-history";

interface SourceEffect {
  after: "available" | "deleted";
  before: "available" | "deleted";
  sourcePath: string;
}
interface HistoryDestination {
  activeInstanceId: string | null;
  files: SourceEffect[];
  instances: EditingInstance[];
  lifecycleInstanceIds: string[];
  transformedInstanceIds: string[];
}

function historyValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        historyValuesEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

function currentHistorySnapshot(state: RootState, id: string): EditorSnapshot | undefined {
  const instance = state.editingInstances.entities[id];
  if (!instance) return undefined;
  if (
    state.editingInstances.activeInstanceId === id &&
    state.source.source &&
    normalizeSourceKey(state.source.source.sourcePath) ===
      normalizeSourceKey(instance.snapshot.source.sourcePath)
  )
    return createEditorSnapshotFromState(state, state.source.source) ?? instance.snapshot;
  return instance.snapshot;
}

const valueOf = (slot: HistorySlot) => (slot.present ? slot.value : undefined);

function applyChange(
  snapshot: EditorSnapshot,
  change: HistoryChange,
  direction: "undo" | "redo",
): EditorSnapshot | null {
  const value = valueOf(direction === "undo" ? change.before : change.after);
  const next = { ...snapshot };
  if (change.field === "trim") next.trim = value as EditorSnapshot["trim"];
  else if (change.field === "crop") next.crop = value as EditorSnapshot["crop"];
  else if (change.field === "rotation") next.rotation = value as EditorSnapshot["rotation"];
  else if (change.field === "flipHorizontal") next.flipHorizontal = value as boolean;
  else if (change.field === "flipVertical") next.flipVertical = value as boolean;
  else if (change.field === "chapters") next.chapters = value as EditorSnapshot["chapters"];
  else if (change.field.startsWith("audio:")) {
    const streamIndex = Number(change.field.slice("audio:".length));
    const tracks = snapshot.audio.tracks.filter((track) => track.streamIndex !== streamIndex);
    if (value !== undefined) tracks.push(value as unknown as AudioTrackSettings);
    next.audio = { tracks: tracks.sort((a, b) => a.streamIndex - b.streamIndex) };
  } else if (change.field.startsWith("chapter:")) {
    const id = change.field.slice("chapter:".length);
    const chapters = (snapshot.chapters ?? []).filter((chapter) => chapter.id !== id);
    if (value !== undefined)
      chapters.push(value as unknown as NonNullable<EditorSnapshot["chapters"]>[number]);
    next.chapters = chapters.sort((a, b) => a.startMicros - b.startMicros);
  } else return null;
  return next;
}

/** Resolve semantic state only. This function never dispatches or performs media/filesystem work. */
function resolveHistoryDestination(
  state: RootState,
  position: number,
  includeNavigation: boolean,
  activateInstanceId?: string,
): HistoryDestination | null {
  const history = state.workspaceHistory;
  let activeInstanceId = state.editingInstances.activeInstanceId;
  let ids = [...state.editingInstances.ids];
  const instances = new Map(
    ids.flatMap((id) => {
      const instance = state.editingInstances.entities[id];
      const snapshot = currentHistorySnapshot(state, id);
      return instance && snapshot
        ? [
            [
              id,
              {
                ...instance,
                snapshot,
                ...(id === activeInstanceId && state.source.source
                  ? { optimizedArguments: state.exportPresets.argumentsText }
                  : {}),
              },
            ] as const,
          ]
        : [];
    }),
  );

  const known = new Map(instances);
  const availability = new Map<string, SourceAvailability>();
  for (const instance of instances.values())
    availability.set(
      normalizeSourceKey(instance.snapshot.source.sourcePath),
      instance.sourceAvailability,
    );
  const files = new Map<string, SourceEffect>();
  const transformed = new Set<string>();
  const lifecycle = new Set<string>();
  const direction = position < history.position ? "undo" : "redo";
  const operations = history.operations.slice(
    Math.min(position, history.position),
    Math.max(position, history.position),
  );

  if (direction === "undo") operations.reverse();
  for (const operation of operations) {
    if (operation.kind === "information") continue;
    if (operation.kind === "external") {
      if (
        !operation.payload ||
        typeof operation.payload !== "object" ||
        Array.isArray(operation.payload)
      )
        return null;
      const payload = operation.payload as Record<string, unknown>;
      if (operation.type === "source.availability") {
        const sourcePath = payload.sourcePath;
        const before = direction === "undo" ? payload.after : payload.before;
        const after = direction === "undo" ? payload.before : payload.after;
        if (
          typeof sourcePath !== "string" ||
          (before !== "available" && before !== "deleted") ||
          (after !== "available" && after !== "deleted")
        )
          return null;
        const key = normalizeSourceKey(sourcePath);
        if ((availability.get(key) ?? before) !== before) return null;
        if (
          [...instances.values()].some(
            (instance) =>
              normalizeSourceKey(instance.snapshot.source.sourcePath) === key &&
              instance.sourceAvailability !== before,
          )
        )
          return null;
        const previous = files.get(key);
        files.set(key, { before: previous?.before ?? before, after, sourcePath });
        availability.set(key, after);
        for (const [id, instance] of instances) {
          if (normalizeSourceKey(instance.snapshot.source.sourcePath) === key)
            instances.set(id, { ...instance, sourceAvailability: after });
        }
      } else if (operation.type === "instances.lifecycle") {
        type Indexed = { index: number; instance: EditingInstance };
        const before = payload.before as Indexed[];
        const after = payload.after as Indexed[];
        if (!Array.isArray(before) || !Array.isArray(after)) return null;
        const desired = direction === "undo" ? before : after;
        const affected = new Set([...before, ...after].map(({ instance }) => instance.id));
        const expectedIds = new Set(
          (direction === "undo" ? after : before).map(({ instance }) => instance.id),
        );

        if ([...affected].some((id) => instances.has(id) !== expectedIds.has(id))) return null;
        ids = ids.filter((id) => !affected.has(id));
        for (const id of affected) {
          lifecycle.add(id);
          instances.delete(id);
          transformed.delete(id);
        }
        for (const { index, instance } of [...desired].sort((a, b) => a.index - b.index)) {
          const previous = known.get(instance.id);
          const restored = {
            ...instance,
            ...(previous?.media ? { media: previous.media } : {}),
            exportAttempts: previous?.exportAttempts ?? instance.exportAttempts,
            sourceAvailability:
              availability.get(normalizeSourceKey(instance.snapshot.source.sourcePath)) ??
              instance.sourceAvailability,
          };

          ids.splice(Math.max(0, Math.min(index, ids.length)), 0, instance.id);
          instances.set(instance.id, restored);
          known.set(instance.id, restored);
        }
        const active = direction === "undo" ? payload.beforeActiveId : payload.afterActiveId;
        if (active !== null && typeof active !== "string") return null;
        activeInstanceId = active;
      } else return null;
      continue;
    }
    if (!includeNavigation && operation.role === "navigation") continue;
    for (const change of operation.changes) {
      if (change.target.kind === "workspace" && change.field === "activeInstanceId") {
        const value = valueOf(direction === "undo" ? change.before : change.after);
        if (value !== null && typeof value !== "string") return null;
        activeInstanceId = value;
        continue;
      }
      if (change.target.kind !== "instance") return null;
      const instance = instances.get(change.target.instanceId);
      if (
        !instance ||
        normalizeSourceKey(instance.snapshot.source.sourcePath) !==
          normalizeSourceKey(change.target.sourceId)
      )
        return null;
      const projection = historyProjection(instance.snapshot);
      const expected = valueOf(direction === "undo" ? change.after : change.before);
      const fullTrimBaseline =
        change.field === "trim" &&
        "kind" in instance.snapshot.trim &&
        instance.snapshot.trim.kind === "full-source" &&
        typeof expected === "object" &&
        expected !== null &&
        "startMicros" in expected &&
        expected.startMicros === 0;

      const current =
        change.field === "chapters" ? (instance.snapshot.chapters ?? []) : projection[change.field];

      if (!historyValuesEqual(current, expected) && !fullTrimBaseline) return null;
      const snapshot = applyChange(instance.snapshot, change, direction);
      if (!snapshot) return null;
      instances.set(instance.id, { ...instance, snapshot });
      if (change.field === "rotation" || change.field === "crop") transformed.add(instance.id);
    }
  }
  if (activateInstanceId) activeInstanceId = activateInstanceId;
  const active = activeInstanceId ? instances.get(activeInstanceId) : null;
  if (activeInstanceId && (!active || active.draftAvailable === false)) return null;
  if (
    active &&
    activeInstanceId !== state.editingInstances.activeInstanceId &&
    active.sourceAvailability !== "available"
  )
    return null;
  return {
    activeInstanceId,
    files: [...files.values()].filter((effect) => effect.before !== effect.after),
    instances: ids.map((id) => instances.get(id)!),
    lifecycleInstanceIds: [...lifecycle].filter((id) => instances.has(id)),
    transformedInstanceIds: [...transformed],
  };
}

export { currentHistorySnapshot, historyValuesEqual, resolveHistoryDestination };
export type { HistoryDestination, SourceEffect };
