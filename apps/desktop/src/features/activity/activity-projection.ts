import type {
  DiagnosticEvent,
  DiagnosticSessionMetadata,
  DiagnosticValue,
} from "@/lib/tauri/diagnostics.types";

export type ActivityKind = "fast-cut" | "file-deleted" | "file-restored" | "render";
export type ActivityStatus = "cancelled" | "completed" | "failed" | "interrupted" | "pending";
export type ActivityAction =
  { kind: "open"; path: string } | { kind: "restore"; path: string; targetId: string };
export interface ActivityEntry {
  action?: ActivityAction;
  data?: Record<string, DiagnosticValue>;
  id: string;
  kind: ActivityKind;
  operationId?: string;
  path?: string;
  sessionId: string;
  startedAt: string;
  status: ActivityStatus;
  title: string;
}
export interface ActivitySessionGroup extends DiagnosticSessionMetadata {
  entries: readonly ActivityEntry[];
  isCurrent: boolean;
}
export interface ActivityProjectionLabels {
  fastCutCancelled: string;
  fastCutCompleted: string;
  fastCutFailed: string;
  fastCutInterrupted: string;
  fastCutting: string;
  fileDeleted: string;
  fileRestored: string;
  renderCancelled: string;
  renderCompleted: string;
  renderFailed: string;
  rendering: string;
  renderInterrupted: string;
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
  "source.file-delete.completed": projectFileDeleted,
  "source.file-restore.completed": (event, labels) =>
    createActivityEntry(event, "file-restored", labels.fileRestored, {
      path: diagnosticString(event.data?.sourcePath),
    }),
} satisfies Record<string, ActivityEventProjector>;

export function projectActivityEvent(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  if (isExportLifecycleEvent(event)) return projectLegacyExportTerminal(event, labels);
  const projector = ACTIVITY_EVENT_CONFIG[event.event as keyof typeof ACTIVITY_EVENT_CONFIG];
  return projector?.(event, labels) ?? null;
}
export function projectActivityEvents(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
  currentSessionId: string | null = null,
): ActivityEntry[] {
  const entries = projectExportLifecycleEvents(events, labels, currentSessionId);
  const seenIds = new Set(entries.map((entry) => entry.id));
  for (const event of events) {
    if (isExportLifecycleEvent(event)) continue;
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
  return entries.map((entry) =>
    entry.action?.kind !== "restore" ||
    (entry.sessionId === currentSessionId && restorableTargetIds.has(entry.action.targetId))
      ? entry
      : { ...entry, action: undefined },
  );
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
  for (const session of sessions)
    if (!uniqueSessions.has(session.sessionId)) uniqueSessions.set(session.sessionId, session);
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
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
    startedAt,
  );

  const versionLabel =
    group.appVersion !== null && group.appVersion !== currentAppVersion
      ? `v${group.appVersion} · `
      : "";

  return {
    label: `${versionLabel}${dateLabel} · ${timeLabel}`,
    tone: versionLabel ? "warning" : "default",
  };
}
function projectExportLifecycleEvents(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
  currentSessionId: string | null,
): ActivityEntry[] {
  const eventsByOperation = new Map<string, DiagnosticEvent[]>();
  const entries: ActivityEntry[] = [];
  for (const event of events) {
    if (!isExportLifecycleEvent(event)) continue;
    if (!event.operationId) {
      const entry = projectLegacyExportTerminal(event, labels);
      if (entry) entries.push(entry);
      continue;
    }
    const operationEvents = eventsByOperation.get(event.operationId) ?? [];
    operationEvents.push(event);
    eventsByOperation.set(event.operationId, operationEvents);
  }
  for (const operationEvents of eventsByOperation.values()) {
    const entry = projectExportOperation(operationEvents, labels, currentSessionId);
    if (entry) entries.push(entry);
  }
  return entries;
}
function projectExportOperation(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
  currentSessionId: string | null,
): ActivityEntry | null {
  const started = events.find((event) => event.event === "ffmpeg.export.started");
  const terminal = events.find(isExportTerminalEvent);
  const metadata = exportMetadata(started?.data) ?? exportMetadata(terminal?.data);
  if (!started || !metadata) return terminal ? projectLegacyExportTerminal(terminal, labels) : null;
  if (Number.isNaN(Date.parse(started.timestamp))) return null;
  const status: ActivityStatus = terminal
    ? exportStatus(terminal)
    : started.sessionId === currentSessionId
      ? "pending"
      : "interrupted";

  const path = diagnosticString(terminal?.data?.outputPath) ?? metadata.path;
  return {
    ...(started.data ? { data: started.data } : {}),
    ...(path && status === "completed" ? { action: { kind: "open", path } as const } : {}),
    id: `${started.sessionId}:${started.operationId}:ffmpeg.export`,
    kind: metadata.kind,
    operationId: started.operationId,
    path,
    sessionId: started.sessionId,
    startedAt: started.timestamp,
    status,
    title: exportTitle(metadata.kind, status, labels),
  };
}
function projectLegacyExportTerminal(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  if (!isExportTerminalEvent(event)) return null;
  const metadata = exportMetadata(event.data);
  if (!metadata || Number.isNaN(Date.parse(event.timestamp))) return null;
  const status = exportStatus(event);
  const path = diagnosticString(event.data?.outputPath) ?? metadata.path;
  return {
    ...(event.data ? { data: event.data } : {}),
    ...(path && status === "completed" ? { action: { kind: "open", path } as const } : {}),
    id: `${event.sessionId}:${event.operationId ?? event.timestamp}:ffmpeg.export`,
    kind: metadata.kind,
    ...(event.operationId ? { operationId: event.operationId } : {}),
    path,
    sessionId: event.sessionId,
    startedAt: event.timestamp,
    status,
    title: exportTitle(metadata.kind, status, labels),
  };
}
function isExportLifecycleEvent(event: DiagnosticEvent): boolean {
  return event.event === "ffmpeg.export.started" || isExportTerminalEvent(event);
}
function isExportTerminalEvent(event: DiagnosticEvent): boolean {
  return (
    event.event === "ffmpeg.export.completed" ||
    event.event === "ffmpeg.export.failed" ||
    event.event === "ffmpeg.export.cancelled"
  );
}
function exportMetadata(
  data: Record<string, DiagnosticValue> | undefined,
): { kind: Extract<ActivityKind, "fast-cut" | "render">; path?: string } | null {
  const outputType = data?.outputType ?? data?.route;
  if (outputType !== "fast" && outputType !== "optimized") return null;
  return {
    kind: outputType === "fast" ? "fast-cut" : "render",
    path: diagnosticString(data?.outputPath),
  };
}
function exportStatus(
  event: DiagnosticEvent,
): Extract<ActivityStatus, "cancelled" | "completed" | "failed"> {
  if (event.event === "ffmpeg.export.cancelled") return "cancelled";
  if (event.event === "ffmpeg.export.failed") return "failed";
  return "completed";
}
function exportTitle(
  kind: Extract<ActivityKind, "fast-cut" | "render">,
  status: ActivityStatus,
  labels: ActivityProjectionLabels,
): string {
  const titles = {
    "fast-cut": {
      cancelled: labels.fastCutCancelled,
      completed: labels.fastCutCompleted,
      failed: labels.fastCutFailed,
      interrupted: labels.fastCutInterrupted,
      pending: labels.fastCutting,
    },
    render: {
      cancelled: labels.renderCancelled,
      completed: labels.renderCompleted,
      failed: labels.renderFailed,
      interrupted: labels.renderInterrupted,
      pending: labels.rendering,
    },
  } satisfies Record<Extract<ActivityKind, "fast-cut" | "render">, Record<ActivityStatus, string>>;

  return titles[kind][status];
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
  if (Number.isNaN(Date.parse(event.timestamp))) return null;
  return {
    ...(event.data ? { data: event.data } : {}),
    id: `${event.sessionId}:${event.operationId ?? event.timestamp}:${event.event}`,
    kind,
    ...metadata,
    ...(event.operationId ? { operationId: event.operationId } : {}),
    sessionId: event.sessionId,
    startedAt: event.timestamp,
    status: "completed",
    title,
  };
}
function diagnosticString(value: DiagnosticValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function compareActivityEntries(left: ActivityEntry, right: ActivityEntry): number {
  const timestampDifference = Date.parse(right.startedAt) - Date.parse(left.startedAt);
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
