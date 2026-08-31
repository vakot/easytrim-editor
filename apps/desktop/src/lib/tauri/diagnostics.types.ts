export type DiagnosticLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type DiagnosticResult =
  "started" | "success" | "cancelled" | "failed" | "ignored" | "rejected";
export type DiagnosticOriginType =
  "button" | "hotkey" | "menu" | "timeline" | "system" | "restore" | "internal";
export type DiagnosticEventName = `${string}.${string}.${string}`;
export type DiagnosticOperationName = `${string}.${string}`;
export type DiagnosticValue =
  boolean | number | string | null | DiagnosticValue[] | { [key: string]: DiagnosticValue };

export interface DiagnosticOrigin {
  id?: string;
  type: DiagnosticOriginType;
}

export interface DiagnosticEventInput {
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

export interface DiagnosticEvent extends DiagnosticEventInput {
  sessionId: string;
  timestamp: string;
}

export interface DiagnosticsBootstrap {
  appVersion: string;
  recovery: StartupRecovery | null;
  sessionId: string;
}

export type SerializedDiagnosticError = {
  cause?: SerializedDiagnosticError | DiagnosticValue;
  message: string;
  name: string;
  stack?: string;
};

export interface StartupRecovery {
  classification: "abnormal_shutdown" | "frontend_fatal_error" | "native_panic";
  reportId: string;
  reportPath: string;
  sessionId: string;
}
