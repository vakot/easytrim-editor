use std::path::PathBuf;

use crate::{
    domain::source::{SourceRef, validate_source},
    error::AppError,
    media::probe::MediaInfo,
    state::{AppState, PreviewStreamSelection},
};

pub fn activate_source(
    state: &AppState,
    path: PathBuf,
    cached_media: Option<MediaInfo>,
) -> Result<SourceRef, AppError> {
    let generation = state.begin_source_replacement()?;
    let validated = validate_source(&path)?;
    let load_token = state.complete_source_replacement(generation, validated)?;
    if let Some(media) = cached_media {
        let video_stream_index = media.video.stream_index;
        let audio_stream_index = media
            .audio_streams
            .iter()
            .find(|stream| stream.is_default)
            .or_else(|| media.audio_streams.first())
            .map(|stream| stream.stream_index);
        let audio_stream_indexes = media
            .audio_streams
            .iter()
            .map(|stream| stream.stream_index)
            .collect();
        state.remember_inspected_streams(
            load_token,
            media,
            PreviewStreamSelection {
                video_stream_index,
                audio_stream_index,
            },
            audio_stream_indexes,
        )?;
    }
    let active_source = state.resolve_source_by_load_token(load_token)?;
    source_ref_from_path(active_source.path)
}

fn source_ref_from_path(path: PathBuf) -> Result<SourceRef, AppError> {
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::internal("The selected source has no usable file name."))?;

    Ok(SourceRef {
        display_name,
        source_path: path.display().to_string(),
    })
}
