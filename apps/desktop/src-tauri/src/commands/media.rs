use crate::{
    error::AppError,
    media::probe::{MediaInfo, inspect_media as probe_media},
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub async fn inspect_media(
    source_id: String,
    state: State<'_, AppState>,
) -> Result<MediaInfo, AppError> {
    let active_source = state.resolve_source(&source_id)?;
    let inspected_source_id = active_source.source_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        probe_media(inspected_source_id, &active_source.path)
    })
    .await
    .map_err(|_| AppError::internal("Video inspection stopped unexpectedly."))??;

    state.resolve_source(&source_id)?;
    Ok(result)
}
