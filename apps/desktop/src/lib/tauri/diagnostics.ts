import { invoke } from "@tauri-apps/api/core";

import type {
  DiagnosticEvent,
  DiagnosticEventInput,
  DiagnosticsBootstrap,
  DiagnosticSessionSummary,
  StartupRecovery,
} from "./diagnostics.types";
import { parseDiagnosticEvents, parseDiagnosticSessionSummaries } from "./diagnostics.utils";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function bootstrapNativeDiagnostics(): Promise<DiagnosticsBootstrap | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DiagnosticsBootstrap>("diagnostics_bootstrap");
}

export async function completeDiagnosticsSession(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("complete_diagnostics_session");
}

export async function persistDiagnosticEvent(event: DiagnosticEventInput): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("record_diagnostic_event", { event });
}

export async function listPersistedDiagnosticSessions(): Promise<DiagnosticSessionSummary[]> {
  if (!isTauriRuntime()) return [];
  return parseDiagnosticSessionSummaries(
    await invoke<unknown>("list_persisted_diagnostic_sessions"),
  );
}

export async function readPersistedDiagnosticSessionEvents(
  sessionId: string,
): Promise<DiagnosticEvent[]> {
  if (!isTauriRuntime()) return [];
  return parseDiagnosticEvents(
    await invoke<unknown>("read_persisted_diagnostic_session_events", { sessionId }),
  );
}

export async function recordUiHeartbeat(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("record_ui_heartbeat");
}

export async function revealDiagnosticLogs(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("reveal_diagnostic_logs");
}

export async function revealDiagnosticReport(recovery: StartupRecovery): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("reveal_diagnostic_report", { reportId: recovery.reportId });
}
