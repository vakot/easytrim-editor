export type DiagnosticLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type DiagnosticResult =
  "started" | "success" | "cancelled" | "failed" | "ignored" | "rejected";
export type DiagnosticOriginType =
  "button" | "hotkey" | "menu" | "timeline" | "system" | "restore" | "internal";
export type DiagnosticEventName = `${string}.${string}.${string}`;
export type DiagnosticOperationName = `${string}.${string}`;
export type DiagnosticValue =
  boolean | number | string | null | DiagnosticValue[] | { [key: string]: DiagnosticValue };

interface DiagnosticOrigin {
  id?: string;
  type: DiagnosticOriginType;
}

interface DiagnosticEventInput {
  category: string;
  data?: Record<string, DiagnosticValue>;
  durationMs?: number;
  event: DiagnosticEventName;
  level: DiagnosticLevel;
  operationId?: string;
  origin?: DiagnosticOrigin;
  parentOperationId?: string;
  result?: DiagnosticResult;
  snapshotId?: string;
}

interface DiagnosticEvent extends DiagnosticEventInput {
  sessionId: string;
  timestamp: string;
}

interface DiagnosticsBootstrap {
  appVersion: string;
  recovery: StartupRecovery | null;
  sessionId: string;
  startedAt: string;
}

interface DiagnosticSessionMetadata {
  appVersion: string | null;
  sessionId: string;
  startedAt: string;
}

interface DiagnosticSessionSummary extends DiagnosticSessionMetadata {
  endedAt: string | null;
  gracefulShutdown: boolean;
}

export type SerializedDiagnosticError = {
  cause?: SerializedDiagnosticError | DiagnosticValue;
  message: string;
  name: string;
  stack?: string;
};

interface StartupRecovery {
  classification: "abnormal_shutdown" | "frontend_fatal_error" | "native_panic";
  reportId: string;
  reportPath: string;
  sessionId: string;
}

export type {
  DiagnosticEvent,
  DiagnosticEventInput,
  DiagnosticOrigin,
  DiagnosticsBootstrap,
  DiagnosticSessionMetadata,
  DiagnosticSessionSummary,
  StartupRecovery,
};
