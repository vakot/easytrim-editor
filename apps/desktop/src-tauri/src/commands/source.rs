use std::path::PathBuf;

use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::{
    application::import_source::import_source,
    domain::source::{SUPPORTED_VIDEO_EXTENSIONS, SourceSelection},
    error::AppError,
    state::AppState,
};

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

#[tauri::command]
pub fn import_dropped_source(
    window: WebviewWindow,
    state: State<'_, AppState>,
    path: PathBuf,
) -> Result<SourceSelection, AppError> {
    // Windows can keep Explorer in front after it provides a drop. Regain focus
    // for the receiving editor, without making a valid import depend on this UX step.
    let _ = window.set_focus();
    import_source(&state, path)
}
