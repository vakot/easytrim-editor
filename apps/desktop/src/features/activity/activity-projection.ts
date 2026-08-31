import type {
  DiagnosticEvent,
  DiagnosticSessionMetadata,
  DiagnosticValue,
} from "@/lib/tauri/diagnostics.types";

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

export interface ActivitySessionGroup extends DiagnosticSessionMetadata {
  entries: readonly ActivityEntry[];
  isCurrent: boolean;
}

export interface ActivityProjectionLabels {
  fastCutCompleted: string;
  fileDeleted: string;
  fileRestored: string;
  renderCompleted: string;
}

export interface ActivitySessionLabels {
  now: string;
  today: string;
  yesterday: string;
}

export interface ActivitySessionPresentation {
  label: string;
  tone: "current" | "default" | "warning";
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

export function groupActivityEntriesBySession(
  entries: readonly ActivityEntry[],
  sessions: readonly DiagnosticSessionMetadata[],
  currentSessionId: string | null,
): ActivitySessionGroup[] {
  const entriesBySession = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const sessionEntries = entriesBySession.get(entry.sessionId) ?? [];
    sessionEntries.push(entry);
    entriesBySession.set(entry.sessionId, sessionEntries);
  }

  const uniqueSessions = new Map<string, DiagnosticSessionMetadata>();
  for (const session of sessions) {
    if (!uniqueSessions.has(session.sessionId)) uniqueSessions.set(session.sessionId, session);
  }

  const groups: ActivitySessionGroup[] = [];
  for (const session of uniqueSessions.values()) {
    const sessionEntries = entriesBySession.get(session.sessionId);
    if (!sessionEntries?.length) continue;
    groups.push({
      ...session,
      entries: [...sessionEntries].sort(compareActivityEntries),
      isCurrent: session.sessionId === currentSessionId,
    });
  }

  return groups.sort(compareActivitySessionGroups);
}

export function getActivitySessionPresentation(
  group: ActivitySessionGroup,
  currentAppVersion: string,
  now: Date,
  locale: string,
  labels: ActivitySessionLabels,
): ActivitySessionPresentation {
  if (group.isCurrent) return { label: labels.now, tone: "current" };

  const startedAt = new Date(group.startedAt);
  const dateLabel = formatSessionDate(startedAt, now, locale, labels);
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(startedAt);

  const versionLabel =
    group.appVersion !== null && group.appVersion !== currentAppVersion
      ? `v${group.appVersion} · `
      : "";

  return {
    label: `${versionLabel}${dateLabel} · ${timeLabel}`,
    tone: versionLabel ? "warning" : "default",
  };
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

function compareActivitySessionGroups(
  left: ActivitySessionGroup,
  right: ActivitySessionGroup,
): number {
  if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
  const timestampDifference = Date.parse(right.startedAt) - Date.parse(left.startedAt);
  return timestampDifference || right.sessionId.localeCompare(left.sessionId);
}

function formatSessionDate(
  startedAt: Date,
  now: Date,
  locale: string,
  labels: Pick<ActivitySessionLabels, "today" | "yesterday">,
): string {
  const dayDifference = calendarDayDifference(now, startedAt);
  if (dayDifference === 0) return labels.today;
  if (dayDifference === 1) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: startedAt.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(startedAt);
}

function calendarDayDifference(later: Date, earlier: Date): number {
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}
