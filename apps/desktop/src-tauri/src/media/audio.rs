use std::sync::atomic::{AtomicBool, Ordering};

use crate::{
    error::{AppError, AppErrorMessageId},
    media::{
        audio_filters::{
            compiler::{CANONICAL_SAMPLE_RATE, compile_chain},
            engine::{AudioProcessingEngine, RenderRequest},
            model::AudioChainSelection,
            pcm_cache::FrameRange,
        },
        export::validate_audio_stream,
        probe::MediaInfo,
    },
    state::ActiveSource,
};

const PLAYBACK_PCM_CHANNELS: u16 = 2;
const PLAYBACK_PCM_MAX_CHUNK_MICROS: u64 = 2_000_000;

/// Serves one playback chunk of processed audio as interleaved little-endian f32 stereo at 48 kHz.
///
/// This is the compatibility boundary between the WebAudio playback runtime and the processed
/// audio renderer: playback renders the whole source timeline as one continuous range, so chunks
/// requested in order continue one render session and stateful filters never restart at a chunk
/// boundary. Float samples keep peaks above full scale so Track Volume can still attenuate them.
pub fn decode_playback_chunk(
    engine: &AudioProcessingEngine,
    source: &ActiveSource,
    track: &AudioChainSelection,
    start_micros: u64,
    duration_micros: u64,
    operation_cancellation: &AtomicBool,
) -> Result<Vec<u8>, AppError> {
    let media = source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request(
            AppErrorMessageId::MediaAudioPlaybackChunkRequiresInspectedSourceMedia,
        )
    })?;
    validate_audio_stream(media, track.stream_index)?;
    let chain = compile_chain(&track.filters, &track.loudness_measurements)?;
    let end_micros = start_micros
        .checked_add(duration_micros)
        .ok_or_else(invalid_range)?;
    let media_duration = u64::try_from(media.duration_micros).unwrap_or_default();
    if duration_micros == 0
        || duration_micros > PLAYBACK_PCM_MAX_CHUNK_MICROS
        || end_micros > media_duration
    {
        return Err(invalid_range());
    }

    let range = processed_timeline_range(media);
    let start = micros_to_frames(start_micros);
    let end = micros_to_frames(end_micros).min(range.end);
    if end <= start {
        return Err(invalid_range());
    }
    let (samples, _quality) = engine.render(
        &RenderRequest {
            source,
            stream_index: track.stream_index,
            chain: &chain,
            range,
            start,
            frames: end - start,
            channels: PLAYBACK_PCM_CHANNELS,
        },
        &|| operation_cancellation.load(Ordering::Acquire),
    )?;
    Ok(samples
        .iter()
        .flat_map(|sample| sample.to_le_bytes())
        .collect())
}

/// The continuous range every consumer of a stream's processed audio renders: the whole source
/// timeline at the canonical rate. Sharing it keeps playback and waveforms on one render key, so
/// they reuse each other's cached samples instead of superseding each other.
pub fn processed_timeline_range(media: &MediaInfo) -> FrameRange {
    FrameRange {
        start: 0,
        end: micros_to_frames(u64::try_from(media.duration_micros).unwrap_or_default()),
    }
}

fn invalid_range() -> AppError {
    AppError::invalid_request(AppErrorMessageId::ExportSelectedExportRangeIsInvalid)
}

fn micros_to_frames(micros: u64) -> u64 {
    ((u128::from(micros) * u128::from(CANONICAL_SAMPLE_RATE) + 500_000) / 1_000_000) as u64
}
