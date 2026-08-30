use std::path::PathBuf;

use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::{
    application::source::{activate_source, create_source_ref},
    domain::source::{SUPPORTED_VIDEO_EXTENSIONS, SourceRef, is_supported_video_path},
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

#[tauri::command]
pub fn delete_source_file(source_path: PathBuf) -> Result<(), AppError> {
    let validated = crate::domain::source::validate_source(&source_path)?;
    trash::delete(validated.path).map_err(|error| {
        AppError::io_failed(format!("Could not move the source file to trash: {error}"))
    })
}

#[tauri::command]
pub fn restore_source_file(source_path: PathBuf) -> Result<(), AppError> {
    if !source_path.is_absolute() {
        return Err(AppError::invalid_request(
            "The source path must be absolute.",
        ));
    }
    if !is_supported_video_path(&source_path) {
        return Err(AppError::unsupported_media(
            "This file type is not supported yet.",
        ));
    }
    if source_path.exists() {
        crate::domain::source::validate_source(&source_path)?;
        return Ok(());
    }

    restore_source_from_trash(&source_path)?;
    crate::domain::source::validate_source(&source_path)?;
    Ok(())
}

#[cfg(any(target_os = "freebsd", target_os = "linux", target_os = "windows"))]
fn restore_source_from_trash(source_path: &std::path::Path) -> Result<(), AppError> {
    let item = trash::os_limited::list()
        .map_err(|error| AppError::io_failed(format!("Could not read trash: {error}")))?
        .into_iter()
        .filter(|item| trash_path_matches(&item.original_path(), source_path))
        .max_by_key(|item| item.time_deleted)
        .ok_or_else(|| AppError::io_failed("The source file could not be found in trash."))?;

    trash::os_limited::restore_all([item])
        .map_err(|error| AppError::io_failed(format!("Could not restore the source file: {error}")))
}

#[cfg(not(any(target_os = "freebsd", target_os = "linux", target_os = "windows")))]
fn restore_source_from_trash(_source_path: &std::path::Path) -> Result<(), AppError> {
    Err(AppError::invalid_request(
        "Restoring source files from trash is not supported on this platform.",
    ))
}

#[cfg(target_os = "windows")]
fn trash_path_matches(left: &std::path::Path, right: &std::path::Path) -> bool {
    fn normalize(path: &std::path::Path) -> String {
        path.to_string_lossy()
            .trim_start_matches(r"\\?\")
            .replace('/', "\\")
            .to_lowercase()
    }

    normalize(left) == normalize(right)
}

#[cfg(not(target_os = "windows"))]
fn trash_path_matches(left: &std::path::Path, right: &std::path::Path) -> bool {
    left == right
}
