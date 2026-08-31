import type {
  DiagnosticEvent,
  DiagnosticLevel,
  DiagnosticOrigin,
  DiagnosticOriginType,
  DiagnosticResult,
  DiagnosticSessionSummary,
  DiagnosticValue,
} from "./diagnostics.types";

const diagnosticLevels = new Set<DiagnosticLevel>([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);

const diagnosticResults = new Set<DiagnosticResult>([
  "started",
  "success",
  "cancelled",
  "failed",
  "ignored",
  "rejected",
]);

const diagnosticOriginTypes = new Set<DiagnosticOriginType>([
  "button",
  "hotkey",
  "menu",
  "timeline",
  "system",
  "restore",
  "internal",
]);

export function parseDiagnosticSessionSummaries(value: unknown): DiagnosticSessionSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const summary = parseDiagnosticSessionSummary(item);
    return summary ? [summary] : [];
  });
}

export function parseDiagnosticEvents(value: unknown): DiagnosticEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const event = parseDiagnosticEvent(item);
    return event ? [event] : [];
  });
}

function parseDiagnosticSessionSummary(value: unknown): DiagnosticSessionSummary | null {
  const summary = asRecord(value);
  if (
    !summary ||
    !validSessionId(summary.sessionId) ||
    !validTimestamp(summary.startedAt) ||
    (summary.endedAt !== null && !validTimestamp(summary.endedAt)) ||
    typeof summary.gracefulShutdown !== "boolean"
  ) {
    return null;
  }
  return {
    endedAt: summary.endedAt as string | null,
    gracefulShutdown: summary.gracefulShutdown,
    sessionId: summary.sessionId,
    startedAt: summary.startedAt,
  };
}

function parseDiagnosticEvent(value: unknown): DiagnosticEvent | null {
  const event = asRecord(value);
  if (
    !event ||
    !validName(event.category) ||
    !validName(event.event) ||
    !diagnosticLevels.has(event.level as DiagnosticLevel) ||
    !validSessionId(event.sessionId) ||
    !validTimestamp(event.timestamp)
  ) {
    return null;
  }

  const data = parseDiagnosticData(event.data);
  if (event.data !== undefined && data === undefined) return null;
  const origin = parseDiagnosticOrigin(event.origin);
  if (event.origin !== undefined && origin === undefined) return null;
  const result = optionalSetValue(event.result, diagnosticResults);
  if (event.result !== undefined && result === undefined) return null;

  const optionalStrings = [event.operationId, event.parentOperationId, event.snapshotId];
  if (optionalStrings.some((item) => item !== undefined && typeof item !== "string")) return null;
  if (event.durationMs !== undefined && !isNonNegativeInteger(event.durationMs)) return null;

  return {
    category: event.category,
    ...(data ? { data } : {}),
    ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
    event: event.event as DiagnosticEvent["event"],
    level: event.level as DiagnosticLevel,
    ...(typeof event.operationId === "string" ? { operationId: event.operationId } : {}),
    ...(origin ? { origin } : {}),
    ...(typeof event.parentOperationId === "string"
      ? { parentOperationId: event.parentOperationId }
      : {}),
    ...(result ? { result } : {}),
    sessionId: event.sessionId,
    ...(typeof event.snapshotId === "string" ? { snapshotId: event.snapshotId } : {}),
    timestamp: event.timestamp,
  };
}

function parseDiagnosticData(value: unknown): Record<string, DiagnosticValue> | undefined {
  if (value === undefined) return undefined;
  const data = asRecord(value);
  if (!data) return undefined;
  const parsed: Record<string, DiagnosticValue> = {};
  for (const [key, item] of Object.entries(data)) {
    if (!isDiagnosticValue(item)) return undefined;
    parsed[key] = item;
  }
  return parsed;
}

function parseDiagnosticOrigin(value: unknown): DiagnosticOrigin | undefined {
  if (value === undefined) return undefined;
  const origin = asRecord(value);
  if (!origin || !diagnosticOriginTypes.has(origin.type as DiagnosticOriginType)) return undefined;
  if (origin.id !== undefined && typeof origin.id !== "string") return undefined;
  return {
    ...(typeof origin.id === "string" ? { id: origin.id } : {}),
    type: origin.type as DiagnosticOriginType,
  };
}

function isDiagnosticValue(value: unknown): value is DiagnosticValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isDiagnosticValue);
  const record = asRecord(value);
  return record !== null && Object.values(record).every(isDiagnosticValue);
}

function optionalSetValue<T extends string>(value: unknown, values: Set<T>): T | undefined {
  return typeof value === "string" && values.has(value as T) ? (value as T) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9._-]{1,96}$/.test(value);
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
