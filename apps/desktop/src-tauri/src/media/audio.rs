use std::sync::atomic::{AtomicBool, Ordering};

use serde::Deserialize;

use crate::{
    error::{AppError, AppErrorMessageId},
    media::{
        audio_filters::{
            compiler::{CANONICAL_SAMPLE_RATE, compile_chain},
            engine::{AudioProcessingEngine, RenderPurpose, RenderRequest},
            model::{AudioChainSelection, AudioFilter, FilterMeasurement},
            pcm_cache::{FrameRange, RenderKey},
        },
        export::validate_audio_stream,
        probe::MediaInfo,
    },
    state::ActiveSource,
};

const PLAYBACK_PCM_CHANNELS: u16 = 2;
const PLAYBACK_PCM_MAX_CHUNK_MICROS: u64 = 2_000_000;

/// The chain playback of a stream continues with after its preview ends.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeptPlaybackChain {
    pub filters: Vec<AudioFilter>,
    #[serde(default)]
    pub loudness_measurements: Vec<FilterMeasurement>,
}

/// How a playback chunk relates to the processing that is playing.
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackChunkRole {
    /// The chunk auditions a draft chain; its audio stays temporary until the chain is used as
    /// committed playback audio or the preview is released.
    #[serde(default)]
    pub preview: bool,
    /// The chunk renders processing that will replace the audible processing. It does not
    /// supersede the audible processing, which keeps rendering until playback switches.
    #[serde(default)]
    pub replacement: bool,
}

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
    role: PlaybackChunkRole,
    operation_cancellation: &AtomicBool,
) -> Result<Vec<u8>, AppError> {
    let media = playback_media(source)?;
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
            purpose: if role.preview {
                RenderPurpose::PlaybackPreview
            } else {
                RenderPurpose::Playback
            },
            replacement: role.replacement,
        },
        &|| operation_cancellation.load(Ordering::Acquire),
    )?;
    Ok(samples
        .iter()
        .flat_map(|sample| sample.to_le_bytes())
        .collect())
}

/// Ends the playback preview of one stream, releasing the sessions and audio of every auditioned
/// draft chain. `keep` is the chain playback continues with; its preview audio becomes committed
/// playback audio, so applying a draft does not render it again.
pub fn release_playback_preview(
    engine: &AudioProcessingEngine,
    source: &ActiveSource,
    stream_index: u32,
    keep: Option<&KeptPlaybackChain>,
) -> Result<(), AppError> {
    let media = playback_media(source)?;
    validate_audio_stream(media, stream_index)?;
    let keep = keep
        .map(|kept| {
            let chain = compile_chain(&kept.filters, &kept.loudness_measurements)?;
            Ok::<_, AppError>(RenderKey {
                load_token: source.load_token,
                stream_index,
                graph: chain.canonical_graph(),
                range: processed_timeline_range(media),
                channels: PLAYBACK_PCM_CHANNELS,
            })
        })
        .transpose()?;
    engine.release_preview(source.load_token, stream_index, keep.as_ref());
    Ok(())
}

fn playback_media(source: &ActiveSource) -> Result<&MediaInfo, AppError> {
    source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request(
            AppErrorMessageId::MediaAudioPlaybackChunkRequiresInspectedSourceMedia,
        )
    })
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
