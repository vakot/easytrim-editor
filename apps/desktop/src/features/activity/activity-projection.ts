import type { DiagnosticEvent, DiagnosticValue } from "@/lib/tauri/diagnostics.types";

export type ActivityKind =
  "fast-cut-completed" | "file-deleted" | "file-restored" | "render-completed";

export type ActivityAction =
  { kind: "open"; path: string } | { kind: "restore"; path: string; targetId: string };

export interface ActivityEntry {
  action?: ActivityAction;
  data?: Record<string, DiagnosticValue>;
  id: string;
  kind: ActivityKind;
  path?: string;
  sessionId: string;
  timestamp: string;
  title: string;
}

export interface ActivityGroup {
  date: Date;
  dateKey: string;
  entries: readonly ActivityEntry[];
}

export interface ActivityProjectionLabels {
  fastCutCompleted: string;
  fileDeleted: string;
  fileRestored: string;
  renderCompleted: string;
}

type ActivityEventProjector = (
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
) => ActivityEntry | null;

const ACTIVITY_EVENT_CONFIG = {
  "ffmpeg.export.completed": projectExportCompleted,
  "source.file-delete.completed": projectFileDeleted,
  "source.file-restore.completed": (event, labels) => {
    const path = diagnosticString(event.data?.sourcePath);
    return createActivityEntry(event, "file-restored", labels.fileRestored, { path });
  },
} satisfies Record<string, ActivityEventProjector>;

export function projectActivityEvent(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  const projector = ACTIVITY_EVENT_CONFIG[event.event as keyof typeof ACTIVITY_EVENT_CONFIG];
  return projector?.(event, labels) ?? null;
}

export function projectActivityEvents(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const seenIds = new Set<string>();

  for (const event of events) {
    const entry = projectActivityEvent(event, labels);
    if (!entry || seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    entries.push(entry);
  }

  return entries;
}

export function resolveAvailableActivityActions(
  entries: readonly ActivityEntry[],
  currentSessionId: string | null,
  restorableTargetIds: ReadonlySet<string>,
): ActivityEntry[] {
  return entries.map((entry) => {
    if (
      entry.action?.kind !== "restore" ||
      (entry.sessionId === currentSessionId && restorableTargetIds.has(entry.action.targetId))
    ) {
      return entry;
    }
    return { ...entry, action: undefined };
  });
}

export function groupActivityEntries(entries: readonly ActivityEntry[]): ActivityGroup[] {
  const orderedEntries = [...entries].sort(compareActivityEntries);
  const groups = new Map<string, { date: Date; entries: ActivityEntry[] }>();

  for (const entry of orderedEntries) {
    const timestamp = new Date(entry.timestamp);
    if (Number.isNaN(timestamp.getTime())) continue;
    const dateKey = localDateKey(timestamp);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    groups.set(dateKey, {
      date: new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()),
      entries: [entry],
    });
  }

  return [...groups].map(([dateKey, group]) => ({ dateKey, ...group }));
}

function projectExportCompleted(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  if (event.data?.outputType === "fast") {
    return createCompletedExportEntry(event, "fast-cut-completed", labels.fastCutCompleted);
  }
  if (event.data?.outputType === "optimized") {
    return createCompletedExportEntry(event, "render-completed", labels.renderCompleted);
  }
  return null;
}

function createCompletedExportEntry(
  event: DiagnosticEvent,
  kind: Extract<ActivityKind, "fast-cut-completed" | "render-completed">,
  title: string,
): ActivityEntry | null {
  const path = diagnosticString(event.data?.outputPath);
  return createActivityEntry(event, kind, title, {
    ...(path ? { action: { kind: "open", path } as const } : {}),
    path,
  });
}

function projectFileDeleted(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  const path = diagnosticString(event.data?.sourcePath);
  const targetId = diagnosticString(event.data?.itemId);
  return createActivityEntry(event, "file-deleted", labels.fileDeleted, {
    ...(path && targetId ? { action: { kind: "restore", path, targetId } as const } : {}),
    path,
  });
}

function createActivityEntry(
  event: DiagnosticEvent,
  kind: ActivityKind,
  title: string,
  metadata: Pick<ActivityEntry, "action" | "path"> = {},
): ActivityEntry | null {
  if (!event.operationId || Number.isNaN(Date.parse(event.timestamp))) return null;
  return {
    ...(event.data ? { data: event.data } : {}),
    id: `${event.sessionId}:${event.operationId}:${event.event}`,
    kind,
    ...metadata,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    title,
  };
}

function diagnosticString(value: DiagnosticValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function compareActivityEntries(left: ActivityEntry, right: ActivityEntry): number {
  const timestampDifference = Date.parse(right.timestamp) - Date.parse(left.timestamp);
  return timestampDifference || right.id.localeCompare(left.id);
}

function localDateKey(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => part.toString().padStart(2, "0"))
    .join("-");
}
