use crate::{
    error::AppError,
    media::{
        probe::{MediaInfo, inspect_media as probe_media},
        proxy::generate_preview,
    },
    state::{AppState, PreviewStreamSelection},
};
use serde::Serialize;
use tauri::State;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PreviewKind {
    Source,
    Proxy,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewDescriptor {
    pub source_id: String,
    pub url: String,
    pub kind: PreviewKind,
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

    let audio_stream_index = result
        .audio_streams
        .iter()
        .find(|stream| stream.is_default)
        .or_else(|| result.audio_streams.first())
        .map(|stream| stream.stream_index);
    state.remember_preview_streams(
        &source_id,
        PreviewStreamSelection {
            video_stream_index: result.video.stream_index,
            audio_stream_index,
        },
    )?;
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
        url: preview_url(&source.source_id, PreviewKind::Source),
        kind: PreviewKind::Source,
    })
}

#[tauri::command]
pub async fn prepare_proxy_preview(
    source_id: String,
    state: State<'_, AppState>,
) -> Result<PreviewDescriptor, AppError> {
    let source = state.resolve_source(&source_id)?;
    if !state.preview_is_ready(&source_id)? {
        let generated_source_id = source.source_id.clone();
        let preview = tauri::async_runtime::spawn_blocking(move || generate_preview(&source))
            .await
            .map_err(|_| {
                AppError::internal("Compatible preview preparation stopped unexpectedly.")
            })??;
        state.install_preview(&generated_source_id, preview)?;
    }

    state.resolve_source(&source_id)?;
    Ok(PreviewDescriptor {
        source_id: source_id.clone(),
        url: preview_url(&source_id, PreviewKind::Proxy),
        kind: PreviewKind::Proxy,
    })
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn preview_url(source_id: &str, kind: PreviewKind) -> String {
    format!(
        "http://easycut-media.localhost/{source_id}?variant={}",
        preview_kind_name(kind)
    )
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn preview_url(source_id: &str, kind: PreviewKind) -> String {
    format!(
        "easycut-media://localhost/{source_id}?variant={}",
        preview_kind_name(kind)
    )
}

fn preview_kind_name(kind: PreviewKind) -> &'static str {
    match kind {
        PreviewKind::Source => "source",
        PreviewKind::Proxy => "proxy",
    }
}

#[cfg(test)]
mod tests {
    use super::{PreviewKind, preview_url};

    #[test]
    fn preview_url_contains_only_the_opaque_source_id() {
        let url = preview_url("source-17", PreviewKind::Source);

        assert!(url.ends_with("/source-17?variant=source"));
        assert!(!url.contains('\\'));
    }
}
