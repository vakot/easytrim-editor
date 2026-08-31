import type {
  DiagnosticEvent,
  DiagnosticSessionMetadata,
  DiagnosticValue,
} from "@/lib/tauri/diagnostics.types";

export type ActivityKind =
  "fast-cut" | "file-deleted" | "file-restored" | "files-imported" | "folders-imported" | "render";
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
  snapshotId?: string;
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
  fastCutStarted: string;
  fastCutting: string;
  fileDeleteCancelled: string;
  fileDeleted: string;
  fileDeleteFailed: string;
  fileDeleteInterrupted: string;
  fileDeleting: string;
  fileRestoreCancelled: string;
  fileRestored: string;
  fileRestoreFailed: string;
  fileRestoreInterrupted: string;
  fileRestoring: string;
  importOpenedFiles: (count: number) => string;
  importOpenedFilesFromFolders: (fileCount: number, folderCount: number) => string;
  renderCancelled: string;
  renderCompleted: string;
  renderFailed: string;
  rendering: string;
  renderInterrupted: string;
  renderStarted: string;
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
export interface ActivityBranch {
  entries: readonly ActivityEntry[];
  id: string;
  path?: string;
  sessionId: string;
  snapshotId: string;
}
export type ActivitySessionItem =
  { branch: ActivityBranch; kind: "branch" } | { entry: ActivityEntry; kind: "entry" };
type ActivityEventProjector = (
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
) => ActivityEntry | null;
const ACTIVITY_EVENT_CONFIG = {
  "export.prepare.started": (event, labels) => projectExportStart(event, labels),
  "source.file-delete.completed": (event, labels) => projectFileTerminal(event, "delete", labels),
  "source.file-delete.failed": (event, labels) => projectFileTerminal(event, "delete", labels),
  "source.file-delete.cancelled": (event, labels) => projectFileTerminal(event, "delete", labels),
  "source.file-restore.completed": (event, labels) => projectFileTerminal(event, "restore", labels),
  "source.file-restore.failed": (event, labels) => projectFileTerminal(event, "restore", labels),
  "source.file-restore.cancelled": (event, labels) => projectFileTerminal(event, "restore", labels),
  "source.import.completed": (event, labels) => projectImportTerminal(event, labels),
  "source.import.failed": (event, labels) => projectImportTerminal(event, labels),
  "source.import.cancelled": (event, labels) => projectImportTerminal(event, labels),
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
  const entries = [
    ...projectExportLifecycleEvents(events, labels, currentSessionId),
    ...projectFileLifecycleEvents(events, labels, currentSessionId),
    ...projectImportLifecycleEvents(events, labels),
  ];

  const seenIds = new Set(entries.map((entry) => entry.id));
  for (const event of events) {
    if (isLifecycleEvent(event)) continue;
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
): ActivityEntry[] {
  return entries.map((entry) =>
    entry.action?.kind !== "restore" || entry.sessionId === currentSessionId
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
export function groupActivityEntriesByBranch(
  entries: readonly ActivityEntry[],
): ActivitySessionItem[] {
  const branches = new Map<string, ActivityBranch>();
  const standalone: ActivitySessionItem[] = [];

  for (const entry of entries) {
    if (!entry.snapshotId) {
      standalone.push({ entry, kind: "entry" });
      continue;
    }

    const id = `${entry.sessionId}:${entry.snapshotId}`;
    const branch = branches.get(id);
    if (branch) {
      branch.entries = [...branch.entries, entry];
      if (!branch.path && entry.path) branch.path = entry.path;
      continue;
    }

    branches.set(id, {
      entries: [entry],
      id,
      ...(entry.path ? { path: entry.path } : {}),
      sessionId: entry.sessionId,
      snapshotId: entry.snapshotId,
    });
  }

  const grouped = [...branches.values()].map((branch) => {
    const entries = [...branch.entries].sort((left, right) => compareActivityEntries(right, left));
    return { branch: { ...branch, entries }, kind: "branch" as const };
  });

  return [...grouped, ...standalone].sort((left, right) =>
    compareActivityEntries(latestActivityEntry(left), latestActivityEntry(right)),
  );
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

function projectFileLifecycleEvents(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
  currentSessionId: string | null,
): ActivityEntry[] {
  const eventsByOperation = new Map<string, DiagnosticEvent[]>();
  const entries: ActivityEntry[] = [];

  for (const event of events) {
    if (!isFileLifecycleEvent(event)) continue;
    if (!event.operationId) {
      const entry = projectLegacyFileTerminal(event, labels);
      if (entry) entries.push(entry);
      continue;
    }

    const operationEvents = eventsByOperation.get(event.operationId) ?? [];
    operationEvents.push(event);
    eventsByOperation.set(event.operationId, operationEvents);
  }

  for (const operationEvents of eventsByOperation.values()) {
    const entry = projectFileOperation(operationEvents, labels, currentSessionId);
    if (entry) entries.push(entry);
  }

  return entries;
}

function projectImportLifecycleEvents(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
): ActivityEntry[] {
  const eventsByOperation = new Map<string, DiagnosticEvent[]>();
  const entries: ActivityEntry[] = [];

  for (const event of events) {
    if (!isImportLifecycleEvent(event) || !event.operationId) continue;
    const operationEvents = eventsByOperation.get(event.operationId) ?? [];
    operationEvents.push(event);
    eventsByOperation.set(event.operationId, operationEvents);
  }

  for (const operationEvents of eventsByOperation.values()) {
    const terminal = operationEvents.find((event) => isImportTerminalEvent(event));
    if (!terminal) continue;
    const started = operationEvents.find((event) => event.event === "source.import.started");
    const entry = projectImportTerminal(terminal, labels, started);
    if (entry) entries.push(entry);
  }

  return entries;
}

function projectImportTerminal(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
  started?: DiagnosticEvent,
): ActivityEntry | null {
  const acceptedFileCount = diagnosticNumber(event.data?.acceptedFileCount) ?? 0;
  const folderCount = diagnosticNumber(event.data?.folderCount) ?? 0;

  const startedAt = started?.timestamp ?? event.timestamp;
  if (Number.isNaN(Date.parse(startedAt))) return null;

  const operationId = started?.operationId ?? event.operationId;
  const sessionId = started?.sessionId ?? event.sessionId;
  const kind = folderCount > 0 ? "folders-imported" : "files-imported";
  const title =
    folderCount > 0
      ? labels.importOpenedFilesFromFolders(acceptedFileCount, folderCount)
      : labels.importOpenedFiles(acceptedFileCount);

  return {
    ...(event.data ? { data: event.data } : {}),
    id: `${sessionId}:${operationId ?? event.timestamp}:source.import`,
    ...(operationId ? { operationId } : {}),
    kind,
    sessionId,
    startedAt,
    status: importStatus(event),
    title,
  };
}

function projectExportStart(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  const metadata = exportMetadata(event.data);
  const snapshotId = activitySnapshotId(event);
  if (!metadata) return null;

  return createActivityEntry(
    event,
    metadata.kind,
    metadata.kind === "fast-cut" ? labels.fastCutStarted : labels.renderStarted,
    {
      path: metadata.path,
      ...(snapshotId ? { snapshotId } : {}),
    },
  );
}

function projectFileOperation(
  events: readonly DiagnosticEvent[],
  labels: ActivityProjectionLabels,
  currentSessionId: string | null,
): ActivityEntry | null {
  const started = events.find((event) => isFileStartedEvent(event));
  const operation = started ? fileOperationKind(started) : fileTerminalOperation(events);
  if (!operation) return null;

  const terminal = events.find((event) => isFileTerminalEvent(event));
  if (!started) return terminal ? projectLegacyFileTerminal(terminal, labels) : null;
  if (Number.isNaN(Date.parse(started.timestamp))) return null;

  const status: ActivityStatus = terminal
    ? fileStatus(terminal)
    : started.sessionId === currentSessionId
      ? "pending"
      : "interrupted";

  const metadata = fileMetadata(started.data) ?? fileMetadata(terminal?.data);
  const path = diagnosticString(terminal?.data?.sourcePath) ?? metadata?.path;
  const targetId =
    diagnosticString(started.data?.itemId) ?? diagnosticString(terminal?.data?.itemId);

  const snapshotId = activitySnapshotId(started) ?? activitySnapshotId(terminal);

  return {
    ...(started.data ? { data: started.data } : {}),
    ...(operation === "delete" && status === "completed" && path && targetId
      ? { action: { kind: "restore", path, targetId } as const }
      : {}),
    id: `${started.sessionId}:${started.operationId}:source.file-${operation}`,
    kind: operation === "delete" ? "file-deleted" : "file-restored",
    operationId: started.operationId,
    path,
    sessionId: started.sessionId,
    ...(snapshotId ? { snapshotId } : {}),
    startedAt: started.timestamp,
    status,
    title: fileTitle(operation, status, labels),
  };
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
  const snapshotId = activitySnapshotId(started) ?? activitySnapshotId(terminal);
  return {
    ...(started.data ? { data: started.data } : {}),
    ...(path && status === "completed" ? { action: { kind: "open", path } as const } : {}),
    id: `${started.sessionId}:${started.operationId}:ffmpeg.export`,
    kind: metadata.kind,
    operationId: started.operationId,
    path,
    sessionId: started.sessionId,
    ...(snapshotId ? { snapshotId } : {}),
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
  const snapshotId = activitySnapshotId(event);
  return {
    ...(event.data ? { data: event.data } : {}),
    ...(path && status === "completed" ? { action: { kind: "open", path } as const } : {}),
    id: `${event.sessionId}:${event.operationId ?? event.timestamp}:ffmpeg.export`,
    kind: metadata.kind,
    ...(event.operationId ? { operationId: event.operationId } : {}),
    path,
    sessionId: event.sessionId,
    ...(snapshotId ? { snapshotId } : {}),
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
function projectFileTerminal(
  event: DiagnosticEvent,
  operation: FileOperation,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  const path = diagnosticString(event.data?.sourcePath);
  const targetId = diagnosticString(event.data?.itemId);
  const status = fileStatus(event);
  return createActivityEntry(
    event,
    operation === "delete" ? "file-deleted" : "file-restored",
    fileTitle(operation, status, labels),
    {
      ...(operation === "delete" && status === "completed" && path && targetId
        ? { action: { kind: "restore", path, targetId } as const }
        : {}),
      path,
      ...(activitySnapshotId(event) ? { snapshotId: activitySnapshotId(event) } : {}),
      status,
    },
  );
}

function projectLegacyFileTerminal(
  event: DiagnosticEvent,
  labels: ActivityProjectionLabels,
): ActivityEntry | null {
  const operation = fileTerminalOperation([event]);
  return operation ? projectFileTerminal(event, operation, labels) : null;
}

type FileOperation = "delete" | "restore";

function fileMetadata(data: Record<string, DiagnosticValue> | undefined): { path?: string } | null {
  if (!data) return null;
  const path = diagnosticString(data.sourcePath);
  return path ? { path } : null;
}

function fileOperationKind(event: DiagnosticEvent): FileOperation | null {
  if (event.event === "source.file-delete.started") return "delete";
  if (event.event === "source.file-restore.started") return "restore";
  return null;
}

function fileTerminalOperation(events: readonly DiagnosticEvent[]): FileOperation | null {
  const event = events.find((candidate) => isFileTerminalEvent(candidate));
  if (event?.event.startsWith("source.file-delete.")) return "delete";
  if (event?.event.startsWith("source.file-restore.")) return "restore";
  return null;
}

function isFileLifecycleEvent(event: DiagnosticEvent): boolean {
  return isFileStartedEvent(event) || isFileTerminalEvent(event);
}

function isImportLifecycleEvent(event: DiagnosticEvent): boolean {
  return event.event === "source.import.started" || isImportTerminalEvent(event);
}

function isImportTerminalEvent(event: DiagnosticEvent): boolean {
  return (
    event.event === "source.import.completed" ||
    event.event === "source.import.failed" ||
    event.event === "source.import.cancelled"
  );
}

function importStatus(
  event: DiagnosticEvent,
): Extract<ActivityStatus, "cancelled" | "completed" | "failed"> {
  if (event.event === "source.import.cancelled") return "cancelled";
  if (event.event === "source.import.failed") return "failed";
  return "completed";
}

function isFileStartedEvent(event: DiagnosticEvent): boolean {
  return (
    event.event === "source.file-delete.started" || event.event === "source.file-restore.started"
  );
}

function isFileTerminalEvent(event: DiagnosticEvent): boolean {
  return (
    event.event === "source.file-delete.completed" ||
    event.event === "source.file-delete.failed" ||
    event.event === "source.file-delete.cancelled" ||
    event.event === "source.file-restore.completed" ||
    event.event === "source.file-restore.failed" ||
    event.event === "source.file-restore.cancelled"
  );
}

function fileStatus(
  event: DiagnosticEvent,
): Extract<ActivityStatus, "cancelled" | "completed" | "failed"> {
  if (event.event.endsWith(".cancelled")) return "cancelled";
  if (event.event.endsWith(".failed")) return "failed";
  return "completed";
}

function fileTitle(
  operation: FileOperation,
  status: ActivityStatus,
  labels: ActivityProjectionLabels,
): string {
  const titles = {
    delete: {
      cancelled: labels.fileDeleteCancelled,
      completed: labels.fileDeleted,
      failed: labels.fileDeleteFailed,
      interrupted: labels.fileDeleteInterrupted,
      pending: labels.fileDeleting,
    },
    restore: {
      cancelled: labels.fileRestoreCancelled,
      completed: labels.fileRestored,
      failed: labels.fileRestoreFailed,
      interrupted: labels.fileRestoreInterrupted,
      pending: labels.fileRestoring,
    },
  } satisfies Record<FileOperation, Record<ActivityStatus, string>>;

  return titles[operation][status];
}
function createActivityEntry(
  event: DiagnosticEvent,
  kind: ActivityKind,
  title: string,
  metadata: Partial<Pick<ActivityEntry, "action" | "path" | "snapshotId" | "status">> = {},
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
    status: metadata.status ?? "completed",
    title,
  };
}

function isLifecycleEvent(event: DiagnosticEvent): boolean {
  return (
    isExportLifecycleEvent(event) || isFileLifecycleEvent(event) || isImportLifecycleEvent(event)
  );
}
function diagnosticNumber(value: DiagnosticValue | undefined): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
function diagnosticString(value: DiagnosticValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function compareActivityEntries(left: ActivityEntry, right: ActivityEntry): number {
  const timestampDifference = Date.parse(right.startedAt) - Date.parse(left.startedAt);
  return timestampDifference || right.id.localeCompare(left.id);
}
function latestActivityEntry(item: ActivitySessionItem): ActivityEntry {
  if (item.kind === "entry") return item.entry;
  return item.branch.entries[item.branch.entries.length - 1]!;
}
function activitySnapshotId(event: DiagnosticEvent | null | undefined): string | undefined {
  if (!event) return undefined;
  return (
    event.snapshotId ??
    diagnosticString(event.data?.snapshotId) ??
    diagnosticString(event.data?.itemId)
  );
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
