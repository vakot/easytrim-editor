use std::sync::Arc;

use tauri::State;

use crate::{
    diagnostics::{DiagnosticEventInput, DiagnosticsBootstrap, DiagnosticsState},
    error::AppError,
};

#[tauri::command]
pub fn diagnostics_bootstrap(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<DiagnosticsBootstrap, AppError> {
    diagnostics.bootstrap()
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
pub fn reveal_diagnostic_report(
    diagnostics: State<'_, Arc<DiagnosticsState>>,
    report_id: String,
) -> Result<(), AppError> {
    diagnostics.reveal_report(&report_id)
}
