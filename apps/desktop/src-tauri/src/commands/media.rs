use crate::{
    error::AppError,
    media::{
        audio::generate_audio_previews,
        probe::{MediaInfo, inspect_media as probe_media},
        proxy::generate_preview,
        waveform::{generate_waveforms, validate_waveform_request},
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

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPreviewDescriptor {
    pub source_id: String,
    pub stream_index: u32,
    pub url: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WaveformStatus {
    Ready,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformResult {
    pub source_id: String,
    pub job_id: String,
    pub stream_index: u32,
    pub width: u32,
    pub status: WaveformStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_signal: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AppError>,
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
    let audio_stream_indexes = result
        .audio_streams
        .iter()
        .map(|stream| stream.stream_index)
        .collect();
    state.remember_inspected_streams(
        &source_id,
        result.clone(),
        PreviewStreamSelection {
            video_stream_index: result.video.stream_index,
            audio_stream_index,
        },
        audio_stream_indexes,
    )?;
    Ok(result)
}

#[tauri::command]
pub async fn prepare_audio_previews(
    source_id: String,
    stream_indexes: Vec<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<AudioPreviewDescriptor>, AppError> {
    if stream_indexes.is_empty() || stream_indexes.len() > 32 {
        return Err(AppError::invalid_request(
            "Select between one and 32 audio streams for preview.",
        ));
    }
    let source = state.resolve_source(&source_id)?;
    let mut unique_stream_indexes = stream_indexes.clone();
    unique_stream_indexes.sort_unstable();
    unique_stream_indexes.dedup();
    if unique_stream_indexes.len() != stream_indexes.len() {
        return Err(AppError::invalid_request(
            "Audio preview stream indexes must be unique.",
        ));
    }

    let generated = tauri::async_runtime::spawn_blocking(move || {
        generate_audio_previews(&source, &stream_indexes)
    })
    .await
    .map_err(|_| AppError::internal("Audio preview preparation stopped unexpectedly."))??;

    let mut results = Vec::with_capacity(generated.len());
    for (stream_index, artifact) in generated {
        state.install_audio_preview(&source_id, stream_index, artifact)?;
        results.push(AudioPreviewDescriptor {
            source_id: source_id.clone(),
            stream_index,
            url: audio_preview_url(&source_id, stream_index),
        });
    }
    Ok(results)
}

#[tauri::command]
pub async fn prepare_waveforms(
    source_id: String,
    job_id: String,
    stream_indexes: Vec<u32>,
    width: u32,
    state: State<'_, AppState>,
) -> Result<Vec<WaveformResult>, AppError> {
    if stream_indexes.is_empty() || stream_indexes.len() > 32 {
        return Err(AppError::invalid_request(
            "Select between one and 32 audio streams for waveform generation.",
        ));
    }
    let mut unique_stream_indexes = stream_indexes.clone();
    unique_stream_indexes.sort_unstable();
    unique_stream_indexes.dedup();
    if unique_stream_indexes.len() != stream_indexes.len() {
        return Err(AppError::invalid_request(
            "Waveform stream indexes must be unique.",
        ));
    }

    let waveform_source = state.begin_waveform_job(&source_id, job_id.clone())?;
    for stream_index in &stream_indexes {
        validate_waveform_request(
            &waveform_source.source.audio_stream_indexes,
            *stream_index,
            width,
        )?;
    }

    let mut results = Vec::with_capacity(stream_indexes.len());
    let mut pending_stream_indexes = Vec::new();
    for stream_index in stream_indexes {
        if let Some(has_signal) =
            state.waveform_activity_if_ready(&source_id, stream_index, width)?
        {
            results.push(ready_waveform(
                &source_id,
                &job_id,
                stream_index,
                width,
                has_signal,
            ));
        } else {
            pending_stream_indexes.push(stream_index);
        }
    }

    if pending_stream_indexes.is_empty() {
        results.sort_by_key(|result| result.stream_index);
        return Ok(results);
    }

    let generated = tauri::async_runtime::spawn_blocking(move || {
        generate_waveforms(&waveform_source, &pending_stream_indexes, width)
    })
    .await
    .map_err(|_| AppError::internal("Waveform generation stopped unexpectedly."))??;

    for (stream_index, has_signal, generated) in generated {
        match generated {
            Ok(artifact) => {
                state.install_waveform(
                    &source_id,
                    &job_id,
                    stream_index,
                    width,
                    has_signal,
                    artifact,
                )?;
                results.push(ready_waveform(
                    &source_id,
                    &job_id,
                    stream_index,
                    width,
                    has_signal,
                ));
            }
            Err(error) => results.push(WaveformResult {
                source_id: source_id.clone(),
                job_id: job_id.clone(),
                stream_index,
                width,
                status: WaveformStatus::Failed,
                has_signal: None,
                url: None,
                error: Some(error),
            }),
        }
    }

    results.sort_by_key(|result| result.stream_index);
    Ok(results)
}

fn ready_waveform(
    source_id: &str,
    job_id: &str,
    stream_index: u32,
    width: u32,
    has_signal: Option<bool>,
) -> WaveformResult {
    WaveformResult {
        source_id: source_id.to_owned(),
        job_id: job_id.to_owned(),
        stream_index,
        width,
        status: WaveformStatus::Ready,
        has_signal,
        url: Some(waveform_url(source_id, stream_index, width)),
        error: None,
    }
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
        "http://easytrim-media.localhost/{source_id}?variant={}",
        preview_kind_name(kind)
    )
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn preview_url(source_id: &str, kind: PreviewKind) -> String {
    format!(
        "easytrim-media://localhost/{source_id}?variant={}",
        preview_kind_name(kind)
    )
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn waveform_url(source_id: &str, stream_index: u32, width: u32) -> String {
    format!(
        "http://easytrim-media.localhost/{source_id}?variant=waveform&stream={stream_index}&width={width}"
    )
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn audio_preview_url(source_id: &str, stream_index: u32) -> String {
    format!("http://easytrim-media.localhost/{source_id}?variant=audio&stream={stream_index}")
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn audio_preview_url(source_id: &str, stream_index: u32) -> String {
    format!("easytrim-media://localhost/{source_id}?variant=audio&stream={stream_index}")
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn waveform_url(source_id: &str, stream_index: u32, width: u32) -> String {
    format!(
        "easytrim-media://localhost/{source_id}?variant=waveform&stream={stream_index}&width={width}"
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
    use super::{PreviewKind, preview_url, waveform_url};

    #[test]
    fn preview_url_contains_only_the_opaque_source_id() {
        let url = preview_url("source-17", PreviewKind::Source);

        assert!(url.ends_with("/source-17?variant=source"));
        assert!(!url.contains('\\'));
    }

    #[test]
    fn waveform_url_contains_only_opaque_and_numeric_identifiers() {
        let url = waveform_url("source-17", 4, 1_280);

        assert!(url.ends_with("/source-17?variant=waveform&stream=4&width=1280"));
        assert!(!url.contains('\\'));
    }
}
