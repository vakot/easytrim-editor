import {
  bootstrapNativeDiagnostics,
  persistDiagnosticEvent,
  recordUiHeartbeat,
} from "./tauri/diagnostics";
import type {
  DiagnosticEventInput,
  DiagnosticEventName,
  DiagnosticLevel,
  DiagnosticOperationName,
  DiagnosticOrigin,
  DiagnosticResult,
  DiagnosticValue,
  SerializedDiagnosticError,
  StartupRecovery,
} from "./tauri/diagnostics.types";

interface EventOptions {
  data?: Record<string, DiagnosticValue>;
  durationMs?: number;
  level?: DiagnosticLevel;
  operationId?: string;
  origin?: DiagnosticOrigin;
  parentOperationId?: string;
  result?: DiagnosticResult;
  snapshotId?: string;
}

type OperationOptions = Omit<EventOptions, "operationId" | "result">;

interface ActiveOperation {
  event: DiagnosticOperationName;
  operationId: string;
  parentOperationId?: string;
  startedAt: number;
}

export interface DiagnosticOperation {
  cancel(data?: Record<string, DiagnosticValue>): boolean;
  child(event: DiagnosticOperationName, options?: OperationOptions): DiagnosticOperation;
  complete(data?: Record<string, DiagnosticValue>): boolean;
  event(event: DiagnosticEventName, options?: EventOptions): void;
  fail(error: unknown, data?: Record<string, DiagnosticValue>): boolean;
  readonly operationId: string;
}

let operationSequence = 0;
let recovery: StartupRecovery | null = null;
const activeOperations = new Map<string, ActiveOperation>();

function createOperationId(event: DiagnosticOperationName): string {
  const prefix = event.split(".").slice(0, 2).join("-");
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++operationSequence}`;
  return `${prefix}-${suffix}`;
}

function categoryFromEvent(event: string): string {
  return event.split(".")[0] ?? "internal";
}

function send(event: DiagnosticEventInput): void {
  void persistDiagnosticEvent(event).catch(() => undefined);
}

function terminalEvent(
  active: ActiveOperation,
  result: Extract<DiagnosticResult, "success" | "cancelled" | "failed">,
  data?: Record<string, DiagnosticValue>,
): boolean {
  if (!activeOperations.delete(active.operationId)) return false;
  const suffix = result === "success" ? "completed" : result;
  diagnostics.event(`${active.event}.${suffix}` as DiagnosticEventName, {
    data,
    durationMs: Math.max(0, performance.now() - active.startedAt),
    level: result === "failed" ? "error" : "info",
    operationId: active.operationId,
    parentOperationId: active.parentOperationId,
    result,
  });
  return true;
}

export function serializeDiagnosticError(
  value: unknown,
  seen = new WeakSet<object>(),
): SerializedDiagnosticError {
  if (value instanceof Error) {
    if (seen.has(value)) return { message: "[circular error]", name: value.name || "Error" };
    seen.add(value);
    return {
      ...(value.cause === undefined ? {} : { cause: serializeDiagnosticCause(value.cause, seen) }),
      message: value.message,
      name: value.name || "Error",
      ...(value.stack ? { stack: value.stack.slice(0, 16_384) } : {}),
    };
  }
  return { message: safeString(value), name: "NonErrorRejection" };
}

function serializeDiagnosticCause(
  value: unknown,
  seen: WeakSet<object>,
): SerializedDiagnosticError | DiagnosticValue {
  if (value instanceof Error) return serializeDiagnosticError(value, seen);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  )
    return value;
  return safeString(value);
}

function safeString(value: unknown): string {
  try {
    if (typeof value === "string") return value.slice(0, 2_048);
    return JSON.stringify(value)?.slice(0, 2_048) ?? String(value).slice(0, 2_048);
  } catch {
    return String(value).slice(0, 2_048);
  }
}

export const diagnostics = {
  action(
    event: DiagnosticEventName,
    origin: DiagnosticOrigin,
    data?: Record<string, DiagnosticValue>,
  ) {
    this.event(event, { data, origin, result: "started" });
  },

  error(event: DiagnosticEventName, error: unknown, options: EventOptions = {}) {
    this.event(event, {
      ...options,
      data: { ...options.data, error: serializeDiagnosticError(error) },
      level: "error",
      result: options.result ?? "failed",
    });
  },

  event(event: DiagnosticEventName, options: EventOptions = {}) {
    send({
      category: categoryFromEvent(event),
      event,
      level: options.level ?? "info",
      ...(options.data ? { data: options.data } : {}),
      ...(options.durationMs === undefined ? {} : { durationMs: Math.round(options.durationMs) }),
      ...(options.operationId ? { operationId: options.operationId } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.parentOperationId ? { parentOperationId: options.parentOperationId } : {}),
      ...(options.result ? { result: options.result } : {}),
      ...(options.snapshotId ? { snapshotId: options.snapshotId } : {}),
    });
  },

  fatal(event: DiagnosticEventName, error: unknown, options: EventOptions = {}) {
    this.event(event, {
      ...options,
      data: { ...options.data, error: serializeDiagnosticError(error) },
      level: "fatal",
      result: "failed",
    });
  },

  getActiveOperations(): readonly ActiveOperation[] {
    return [...activeOperations.values()];
  },

  getStartupRecovery(): StartupRecovery | null {
    return recovery;
  },

  async initialize(): Promise<void> {
    const bootstrap = await bootstrapNativeDiagnostics();
    recovery = bootstrap?.recovery ?? null;
  },

  startOperation(
    event: DiagnosticOperationName,
    options: OperationOptions = {},
  ): DiagnosticOperation {
    const operationId = createOperationId(event);
    const active: ActiveOperation = {
      event,
      operationId,
      ...(options.parentOperationId ? { parentOperationId: options.parentOperationId } : {}),
      startedAt: performance.now(),
    };

    activeOperations.set(operationId, active);
    this.event(`${event}.started` as DiagnosticEventName, {
      ...options,
      operationId,
      result: "started",
    });
    return {
      operationId,
      cancel: (data) => terminalEvent(active, "cancelled", data),
      child: (childEvent, childOptions = {}) =>
        diagnostics.startOperation(childEvent, { ...childOptions, parentOperationId: operationId }),
      complete: (data) => terminalEvent(active, "success", data),
      event: (childEvent, childOptions = {}) =>
        diagnostics.event(childEvent, {
          ...childOptions,
          operationId,
          parentOperationId: active.parentOperationId,
        }),
      fail: (error, data) =>
        terminalEvent(active, "failed", { ...data, error: serializeDiagnosticError(error) }),
    };
  },

  warn(event: DiagnosticEventName, options: EventOptions = {}) {
    this.event(event, { ...options, level: "warn" });
  },
};

export function installGlobalDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => {
    diagnostics.fatal("frontend.fatal.error", event.error ?? event.message, {
      data: { filename: event.filename, line: event.lineno, column: event.colno },
      origin: { type: "system" },
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    diagnostics.fatal("frontend.fatal.unhandledrejection", event.reason, {
      origin: { type: "system" },
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  const heartbeat = window.setInterval(
    () => void recordUiHeartbeat().catch(() => undefined),
    5_000,
  );

  void recordUiHeartbeat().catch(() => undefined);
  return () => {
    window.clearInterval(heartbeat);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
