use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::{
    application::source::activate_source,
    domain::source::{
        SUPPORTED_VIDEO_EXTENSIONS, SourceImportResult, SourceRef, collect_source_import,
        is_supported_video_path,
    },
    error::AppError,
    media::probe::MediaInfo,
    state::AppState,
};

#[tauri::command]
pub async fn choose_source(
    app: AppHandle,
    mode: Option<SourcePickerMode>,
) -> Result<Option<SourceImportResult>, AppError> {
    let selected_paths = match mode.unwrap_or_default() {
        SourcePickerMode::Files => app
            .dialog()
            .file()
            .add_filter("Video", SUPPORTED_VIDEO_EXTENSIONS)
            .blocking_pick_files(),
        SourcePickerMode::Folders => app
            .dialog()
            .file()
            .set_title("Add folders")
            .blocking_pick_folders(),
    };

    let Some(selected_paths) = selected_paths else {
        return Ok(None);
    };

    let selected = selected_paths
        .into_iter()
        .map(|selected| {
            selected.into_path().map_err(|_| {
                AppError::invalid_request("The selected source location is not supported.")
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    if selected.is_empty() {
        return Ok(None);
    }

    let result = tauri::async_runtime::spawn_blocking(move || collect_source_import(&selected))
        .await
        .map_err(|_| AppError::internal("The selected sources could not be loaded."))?;
    Ok(Some(result))
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourcePickerMode {
    #[default]
    Files,
    Folders,
}

#[tauri::command]
pub async fn import_dropped_sources(
    window: WebviewWindow,
    paths: Vec<PathBuf>,
) -> Result<SourceImportResult, AppError> {
    // Windows can keep Explorer in front after it provides a drop. Regain focus
    // for the receiving editor, without making a valid import depend on this UX step.
    let _ = window.set_focus();

    tauri::async_runtime::spawn_blocking(move || collect_source_import(&paths))
        .await
        .map_err(|_| AppError::internal("The dropped sources could not be loaded."))
}

#[tauri::command]
pub fn activate_source_path(
    state: State<'_, AppState>,
    source_path: PathBuf,
    media: Option<MediaInfo>,
) -> Result<SourceRef, AppError> {
    activate_source(&state, source_path, media)
}

#[tauri::command]
pub async fn delete_source_file(
    source_path: PathBuf,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let validated = crate::domain::source::validate_source(&source_path)?;
    state.cancel_source_operations(&validated.path)?;
    let path = validated.path;
    tauri::async_runtime::spawn_blocking(move || move_source_to_trash(&path))
        .await
        .map_err(|_| AppError::internal("Moving the source file to trash stopped unexpectedly."))?
        .map_err(|error| {
            AppError::io_failed(format!("Could not move the source file to trash: {error}"))
        })
}

#[cfg(target_os = "windows")]
const TRASH_RETRY_ATTEMPTS: usize = 20;

#[cfg(target_os = "windows")]
const TRASH_RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(100);

fn move_source_to_trash(path: &Path) -> Result<(), trash::Error> {
    #[cfg(target_os = "windows")]
    {
        for attempt in 0..TRASH_RETRY_ATTEMPTS {
            match trash::delete(path) {
                Ok(()) => return Ok(()),
                Err(error)
                    if attempt + 1 < TRASH_RETRY_ATTEMPTS && is_trash_operation_aborted(&error) =>
                {
                    std::thread::sleep(TRASH_RETRY_DELAY);
                }
                Err(error) => return Err(error),
            }
        }

        unreachable!("trash retry count must be greater than zero");
    }

    #[cfg(not(target_os = "windows"))]
    {
        trash::delete(path)
    }
}

#[cfg(target_os = "windows")]
fn is_trash_operation_aborted(error: &trash::Error) -> bool {
    matches!(
        error,
        trash::Error::Unknown { description } if description == "Some operations were aborted"
    )
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
