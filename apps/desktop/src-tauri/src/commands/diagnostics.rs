use std::sync::Arc;

use tauri::State;

use crate::{
    diagnostics::{
        DiagnosticEvent, DiagnosticEventInput, DiagnosticSessionSummary, DiagnosticsBootstrap,
        DiagnosticsState,
    },
    error::AppError,
};

#[tauri::command]
pub fn diagnostics_bootstrap(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<DiagnosticsBootstrap, AppError> {
    diagnostics.bootstrap()
}

#[tauri::command]
pub fn complete_diagnostics_session(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<(), AppError> {
    diagnostics.complete()
}

#[tauri::command]
pub async fn list_persisted_diagnostic_sessions(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<Vec<DiagnosticSessionSummary>, AppError> {
    let diagnostics = Arc::clone(&diagnostics);
    tauri::async_runtime::spawn_blocking(move || diagnostics.list_persisted_sessions())
        .await
        .map_err(|_| AppError::internal("Persisted diagnostic sessions could not be listed."))?
}

#[tauri::command]
pub async fn read_persisted_diagnostic_session_events(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
    session_id: String,
) -> Result<Vec<DiagnosticEvent>, AppError> {
    let diagnostics = Arc::clone(&diagnostics);
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics.read_persisted_session_events(&session_id)
    })
    .await
    .map_err(|_| AppError::internal("Persisted diagnostic events could not be read."))?
}

#[tauri::command]
pub fn record_diagnostic_event(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
    event: DiagnosticEventInput,
) -> Result<(), AppError> {
    diagnostics.record(event)
}

#[tauri::command]
pub fn record_ui_heartbeat(diagnostics: State<'_, Arc<DiagnosticsState>>) -> Result<(), AppError> {
    diagnostics.heartbeat()
}

#[tauri::command]
pub fn reveal_diagnostic_logs(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<(), AppError> {
    diagnostics.reveal_logs()
}

#[tauri::command]
pub fn reveal_diagnostic_report(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
    report_id: String,
) -> Result<(), AppError> {
    diagnostics.reveal_report(&report_id)
}
