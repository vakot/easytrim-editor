use std::sync::Arc;

use serde_json::{Map, Value};
use tauri::State;

use crate::{
    application::statistics::{StatisticsLoadIssue, StatisticsStore},
    diagnostics::{DiagnosticEventInput, DiagnosticsState},
    domain::statistics::UsageStatistics,
};

#[tauri::command]
pub fn get_usage_statistics(statistics: State<'_, Arc<StatisticsStore>>) -> UsageStatistics {
    statistics.snapshot()
}

pub fn record_statistics_load_issue(diagnostics: &DiagnosticsState, issue: &StatisticsLoadIssue) {
    let (event, reason) = match issue {
        StatisticsLoadIssue::Quarantined { reason } => ("statistics.load.quarantined", reason),
        StatisticsLoadIssue::PersistenceDisabled { reason } => {
            ("statistics.load.persistence-disabled", reason)
        }
    };
    record_statistics_event(diagnostics, event, reason);
}

pub fn record_statistics_write_failure(diagnostics: &DiagnosticsState, error: &std::io::Error) {
    record_statistics_event(diagnostics, "statistics.write.failed", &error.to_string());
}

fn record_statistics_event(diagnostics: &DiagnosticsState, event: &str, reason: &str) {
    let _ = diagnostics.record(DiagnosticEventInput {
        category: "statistics".to_owned(),
        data: Some(Map::from_iter([(
            "reason".to_owned(),
            Value::String(reason.to_owned()),
        )])),
        event: event.to_owned(),
        level: "warn".to_owned(),
        operation_id: None,
        origin: None,
        parent_operation_id: None,
        result: Some("failed".to_owned()),
        snapshot_id: None,
        duration_ms: None,
    });
}
