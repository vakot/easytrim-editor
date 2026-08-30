import { invoke } from "@tauri-apps/api/core";

import type {
  DiagnosticEventInput,
  DiagnosticsBootstrap,
  StartupRecovery,
} from "./diagnostics.types";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function bootstrapNativeDiagnostics(): Promise<DiagnosticsBootstrap | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DiagnosticsBootstrap>("diagnostics_bootstrap");
}

export async function persistDiagnosticEvent(event: DiagnosticEventInput): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("record_diagnostic_event", { event });
}

export async function recordUiHeartbeat(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("record_ui_heartbeat");
}

export async function revealDiagnosticReport(recovery: StartupRecovery): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("reveal_diagnostic_report", { reportId: recovery.reportId });
}
