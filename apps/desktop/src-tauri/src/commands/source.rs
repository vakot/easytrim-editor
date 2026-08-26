use std::path::PathBuf;

use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::{
    application::source::{activate_source, create_source_ref},
    domain::source::{SUPPORTED_VIDEO_EXTENSIONS, SourceRef},
    error::AppError,
    state::AppState,
};

#[tauri::command]
pub async fn choose_source(app: AppHandle) -> Result<Vec<SourceRef>, AppError> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Video", SUPPORTED_VIDEO_EXTENSIONS)
        .blocking_pick_files();

    let Some(selected) = selected else {
        return Ok(Vec::new());
    };

    selected
        .into_iter()
        .map(|selected| {
            let path = selected.into_path().map_err(|_| {
                AppError::invalid_request("The selected file location is not supported.")
            })?;
            create_source_ref(path)
        })
        .collect()
}

#[tauri::command]
pub fn import_dropped_sources(
    window: WebviewWindow,
    paths: Vec<PathBuf>,
) -> Result<Vec<SourceRef>, AppError> {
    // Windows can keep Explorer in front after it provides a drop. Regain focus
    // for the receiving editor, without making a valid import depend on this UX step.
    let _ = window.set_focus();

    let sources = paths
        .into_iter()
        .filter_map(|path| create_source_ref(path).ok())
        .collect::<Vec<_>>();
    if sources.is_empty() {
        return Err(AppError::invalid_request(
            "Drop a supported video file instead of an empty selection.",
        ));
    }
    Ok(sources)
}

#[tauri::command]
pub fn activate_source_path(
    state: State<'_, AppState>,
    source_path: PathBuf,
) -> Result<SourceRef, AppError> {
    activate_source(&state, source_path)
}
