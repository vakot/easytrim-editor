use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::{
    application::import_source::import_source,
    domain::source::{SUPPORTED_VIDEO_EXTENSIONS, SourceSelection},
    error::AppError,
    state::AppState,
};

pub const SOURCE_IMPORT_EVENT: &str = "source-import";
pub const SOURCE_DRAG_EVENT: &str = "source-drag";

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum SourceImportEvent {
    Selected { source: SourceSelection },
    Failed { error: AppError },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDragEvent {
    pub active: bool,
}

#[tauri::command]
pub async fn choose_source(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<SourceSelection>, AppError> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Video", SUPPORTED_VIDEO_EXTENSIONS)
        .blocking_pick_file();

    let Some(selected) = selected else {
        return Ok(None);
    };

    let path = selected
        .into_path()
        .map_err(|_| AppError::invalid_request("The selected file location is not supported."))?;

    import_source(&state, path).map(Some)
}

#[cfg(test)]
mod tests {
    use super::SourceDragEvent;

    #[test]
    fn drag_event_exposes_only_overlay_state() {
        let value =
            serde_json::to_value(SourceDragEvent { active: true }).expect("event serializes");

        assert_eq!(value, serde_json::json!({ "active": true }));
    }
}
