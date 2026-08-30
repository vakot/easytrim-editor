use crate::{
    diagnostics::{DiagnosticEventInput, DiagnosticsState},
    error::AppError,
    media::{
        audio::generate_audio_previews,
        probe::{MediaInfo, inspect_media_cancellable as probe_media},
        proxy::generate_preview,
        waveform::{generate_waveforms, validate_waveform_request},
    },
    state::{AppState, PreviewStreamSelection},
};
use serde::Serialize;
use std::sync::Arc;
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
    pub media_token: u64,
    pub url: String,
    pub kind: PreviewKind,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPreviewDescriptor {
    pub media_token: u64,
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
    source_path: String,
    state: State<'_, AppState>,
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<MediaInfo, AppError> {
    let active_source = state.resolve_source_by_path(&source_path)?;
    let load_token = active_source.load_token;
    let cancellation = active_source.cancellation.clone();
    let operation_id = format!("ffprobe-{load_token}");
    record_ffprobe_event(&diagnostics, "ffprobe.process.spawned", &operation_id, None);
    let result = tauri::async_runtime::spawn_blocking(move || {
        probe_media(&active_source.path, move || {
            cancellation.load(std::sync::atomic::Ordering::Acquire)
        })
    })
    .await
    .map_err(|_| AppError::internal("Video inspection stopped unexpectedly."))?;
    let result = match result {
        Ok(media) => {
            record_ffprobe_event(
                &diagnostics,
                "ffprobe.process.exited",
                &operation_id,
                Some("success"),
            );
            media
        }
        Err(error) => {
            record_ffprobe_event(
                &diagnostics,
                "ffprobe.process.exited",
                &operation_id,
                Some("failed"),
            );
            return Err(error);
        }
    };

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
        load_token,
        result.clone(),
        PreviewStreamSelection {
            video_stream_index: result.video.stream_index,
            audio_stream_index,
        },
        audio_stream_indexes,
    )?;
    Ok(result)
}

fn record_ffprobe_event(
    diagnostics: &DiagnosticsState,
    event: &str,
    operation_id: &str,
    result: Option<&str>,
) {
    let _ = diagnostics.record(DiagnosticEventInput {
        category: "ffprobe".to_owned(),
        data: None,
        event: event.to_owned(),
        level: "info".to_owned(),
        operation_id: Some(operation_id.to_owned()),
        origin: None,
        parent_operation_id: None,
        result: result.map(str::to_owned),
        snapshot_id: None,
        duration_ms: None,
    });
}

#[tauri::command]
pub async fn prepare_audio_previews(
    source_path: String,
    stream_indexes: Vec<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<AudioPreviewDescriptor>, AppError> {
    if stream_indexes.is_empty() || stream_indexes.len() > 32 {
        return Err(AppError::invalid_request(
            "Select between one and 32 audio streams for preview.",
        ));
    }
    let source = state.resolve_source_by_path(&source_path)?;
    let media_token = source.load_token;
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
        state.install_audio_preview(media_token, stream_index, artifact)?;
        results.push(AudioPreviewDescriptor {
            media_token,
            stream_index,
            url: audio_preview_url(media_token, stream_index),
        });
    }
    Ok(results)
}

#[tauri::command]
pub async fn prepare_waveforms(
    source_path: String,
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

    let waveform_source = state.begin_waveform_job(&source_path, job_id.clone())?;
    let media_token = waveform_source.source.load_token;
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
            state.waveform_activity_if_ready(media_token, stream_index, width)?
        {
            results.push(ready_waveform(
                media_token,
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
                    media_token,
                    &job_id,
                    stream_index,
                    width,
                    has_signal,
                    artifact,
                )?;
                results.push(ready_waveform(
                    media_token,
                    &job_id,
                    stream_index,
                    width,
                    has_signal,
                ));
            }
            Err(error) => results.push(WaveformResult {
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
    media_token: u64,
    job_id: &str,
    stream_index: u32,
    width: u32,
    has_signal: Option<bool>,
) -> WaveformResult {
    WaveformResult {
        job_id: job_id.to_owned(),
        stream_index,
        width,
        status: WaveformStatus::Ready,
        has_signal,
        url: Some(waveform_url(media_token, stream_index, width)),
        error: None,
    }
}

#[tauri::command]
pub fn prepare_source_preview(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<PreviewDescriptor, AppError> {
    let source = state.resolve_source_by_path(&source_path)?;
    Ok(PreviewDescriptor {
        media_token: source.load_token,
        url: preview_url(source.load_token, PreviewKind::Source),
        kind: PreviewKind::Source,
    })
}

#[tauri::command]
pub async fn prepare_proxy_preview(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<PreviewDescriptor, AppError> {
    let source = state.resolve_source_by_path(&source_path)?;
    let media_token = source.load_token;
    if !state.preview_is_ready(media_token)? {
        let preview_source = source.clone();
        let preview =
            tauri::async_runtime::spawn_blocking(move || generate_preview(&preview_source))
                .await
                .map_err(|_| {
                    AppError::internal("Compatible preview preparation stopped unexpectedly.")
                })??;
        state.install_preview(media_token, preview)?;
    }

    state.resolve_source_by_load_token(source.load_token)?;
    Ok(PreviewDescriptor {
        media_token: source.load_token,
        url: preview_url(source.load_token, PreviewKind::Proxy),
        kind: PreviewKind::Proxy,
    })
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn preview_url(media_token: u64, kind: PreviewKind) -> String {
    format!(
        "http://easytrim-media.localhost/{media_token}?variant={}",
        preview_kind_name(kind)
    )
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn preview_url(media_token: u64, kind: PreviewKind) -> String {
    format!(
        "easytrim-media://localhost/{media_token}?variant={}",
        preview_kind_name(kind)
    )
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn waveform_url(media_token: u64, stream_index: u32, width: u32) -> String {
    format!(
        "http://easytrim-media.localhost/{media_token}?variant=waveform&stream={stream_index}&width={width}"
    )
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn audio_preview_url(media_token: u64, stream_index: u32) -> String {
    format!("http://easytrim-media.localhost/{media_token}?variant=audio&stream={stream_index}")
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn audio_preview_url(media_token: u64, stream_index: u32) -> String {
    format!("easytrim-media://localhost/{media_token}?variant=audio&stream={stream_index}")
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn waveform_url(media_token: u64, stream_index: u32, width: u32) -> String {
    format!(
        "easytrim-media://localhost/{media_token}?variant=waveform&stream={stream_index}&width={width}"
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
    fn preview_url_contains_only_the_opaque_media_token() {
        let url = preview_url(17, PreviewKind::Source);

        assert!(url.ends_with("/17?variant=source"));
        assert!(!url.contains('\\'));
    }

    #[test]
    fn waveform_url_contains_only_opaque_and_numeric_identifiers() {
        let url = waveform_url(17, 4, 1_280);

        assert!(url.ends_with("/17?variant=waveform&stream=4&width=1280"));
        assert!(!url.contains('\\'));
    }
}
