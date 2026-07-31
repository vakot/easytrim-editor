use crate::{
    error::AppError,
    media::probe::{MediaInfo, inspect_media as probe_media},
    state::AppState,
};
use serde::Serialize;
use tauri::State;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewDescriptor {
    pub source_id: String,
    pub url: String,
}

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

#[tauri::command]
pub fn prepare_source_preview(
    source_id: String,
    state: State<'_, AppState>,
) -> Result<PreviewDescriptor, AppError> {
    let source = state.resolve_source(&source_id)?;
    Ok(PreviewDescriptor {
        source_id: source.source_id.clone(),
        url: preview_url(&source.source_id),
    })
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn preview_url(source_id: &str) -> String {
    format!("http://easycut-media.localhost/{source_id}")
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn preview_url(source_id: &str) -> String {
    format!("easycut-media://localhost/{source_id}")
}

#[cfg(test)]
mod tests {
    use super::preview_url;

    #[test]
    fn preview_url_contains_only_the_opaque_source_id() {
        let url = preview_url("source-17");

        assert!(url.ends_with("/source-17"));
        assert!(!url.contains('\\'));
    }
}
