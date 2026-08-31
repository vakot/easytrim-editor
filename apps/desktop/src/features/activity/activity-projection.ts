import type { DiagnosticEvent, DiagnosticValue } from "@/lib/tauri/diagnostics.types";

export type ActivityKind =
  "fast-cut-completed" | "file-deleted" | "file-restored" | "render-completed";

export interface ActivityEntry {
  data?: Record<string, DiagnosticValue>;
  id: string;
  kind: ActivityKind;
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
  "source.file-delete.completed": (event, labels) =>
    createActivityEntry(event, "file-deleted", labels.fileDeleted),
  "source.file-restore.completed": (event, labels) =>
    createActivityEntry(event, "file-restored", labels.fileRestored),
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
    return createActivityEntry(event, "fast-cut-completed", labels.fastCutCompleted);
  }
  if (event.data?.outputType === "optimized") {
    return createActivityEntry(event, "render-completed", labels.renderCompleted);
  }
  return null;
}

function createActivityEntry(
  event: DiagnosticEvent,
  kind: ActivityKind,
  title: string,
): ActivityEntry | null {
  if (!event.operationId || Number.isNaN(Date.parse(event.timestamp))) return null;
  return {
    ...(event.data ? { data: event.data } : {}),
    id: `${event.sessionId}:${event.operationId}:${event.event}`,
    kind,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    title,
  };
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
