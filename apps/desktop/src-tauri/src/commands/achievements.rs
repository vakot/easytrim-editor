use std::sync::Arc;

use serde::Serialize;
use serde_json::{Map, Value};
use tauri::State;

use crate::{
    application::achievements::{AchievementStore, AchievementUpdate},
    diagnostics::{DiagnosticEventInput, DiagnosticsState},
    domain::achievements::{AchievementRecords, RecordIdentifier},
    error::{AppError, AppErrorMessageId},
    persistence::DocumentLoadIssue,
};

/// The most achievements one unlock request may name; the catalog is much smaller.
const MAX_UNLOCK_REQUEST_SIZE: usize = 64;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementUnlockResult {
    records: AchievementRecords,
    /// Achievements this request unlocked; already unlocked ones are never repeated.
    unlocked_achievement_ids: Vec<String>,
}

#[tauri::command]
pub fn get_achievement_records(
    achievements: State<'_, Arc<AchievementStore>>,
) -> AchievementRecords {
    achievements.snapshot()
}

#[tauri::command]
pub fn unlock_achievements(
    achievement_ids: Vec<String>,
    achievements: State<'_, Arc<AchievementStore>>,
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<AchievementUnlockResult, AppError> {
    if achievement_ids.len() > MAX_UNLOCK_REQUEST_SIZE {
        return Err(invalid_identifier());
    }
    let achievement_ids = achievement_ids
        .iter()
        .map(|id| RecordIdentifier::parse(id).ok_or_else(invalid_identifier))
        .collect::<Result<Vec<_>, _>>()?;
    let AchievementUpdate {
        value: (records, unlocked_achievement_ids),
        write_result,
    } = achievements.unlock(&achievement_ids);
    if let Err(error) = write_result {
        record_achievements_write_failure(&diagnostics, &error);
    }
    Ok(AchievementUnlockResult {
        records,
        unlocked_achievement_ids,
    })
}

#[tauri::command]
pub fn record_splash_message_discovery(
    message_id: String,
    achievements: State<'_, Arc<AchievementStore>>,
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<AchievementRecords, AppError> {
    let message_id = RecordIdentifier::parse(&message_id).ok_or_else(invalid_identifier)?;
    let AchievementUpdate {
        value: records,
        write_result,
    } = achievements.discover_splash_message(&message_id);
    if let Err(error) = write_result {
        record_achievements_write_failure(&diagnostics, &error);
    }
    Ok(records)
}

pub fn record_achievements_load_issue(diagnostics: &DiagnosticsState, issue: &DocumentLoadIssue) {
    let (event, reason) = match issue {
        DocumentLoadIssue::Quarantined { reason } => ("achievements.load.quarantined", reason),
        DocumentLoadIssue::PersistenceDisabled { reason } => {
            ("achievements.load.persistence-disabled", reason)
        }
    };
    record_achievements_event(diagnostics, event, reason);
}

fn record_achievements_write_failure(diagnostics: &DiagnosticsState, error: &std::io::Error) {
    record_achievements_event(diagnostics, "achievements.write.failed", &error.to_string());
}

fn record_achievements_event(diagnostics: &DiagnosticsState, event: &str, reason: &str) {
    let _ = diagnostics.record(DiagnosticEventInput {
        category: "achievements".to_owned(),
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

fn invalid_identifier() -> AppError {
    AppError::invalid_request(AppErrorMessageId::AchievementsIdentifierIsInvalid)
}
