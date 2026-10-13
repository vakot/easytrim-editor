use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use crate::{
    error::{AppError, AppErrorMessageId},
    media::export::{AudioTrackSelection, audio_filter_graph, validate_audio_track_selections},
    process::{ProcessOutput, run_bounded_cancellable},
    state::ActiveSource,
};

const STDERR_LIMIT: usize = 128 * 1024;
pub const PLAYBACK_PCM_SAMPLE_RATE: u32 = 48_000;
pub const PLAYBACK_PCM_MAX_CHUNK_MICROS: u64 = 2_000_000;
const PLAYBACK_PCM_MAX_OUTPUT_BYTES: usize =
    PLAYBACK_PCM_SAMPLE_RATE as usize * 2 * std::mem::size_of::<i16>() * 2;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackPcmChunk {
    pub channels: u16,
    pub sample_rate: u32,
    pub samples: Vec<i16>,
}

pub fn decode_playback_chunk(
    source: &ActiveSource,
    track: &AudioTrackSelection,
    start_micros: u64,
    duration_micros: u64,
    operation_cancellation: Arc<AtomicBool>,
) -> Result<PlaybackPcmChunk, AppError> {
    let media = source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request(
            AppErrorMessageId::MediaAudioPlaybackChunkRequiresInspectedSourceMedia,
        )
    })?;
    validate_audio_track_selections(media, std::slice::from_ref(track))?;
    let end_micros = start_micros.checked_add(duration_micros).ok_or_else(|| {
        AppError::invalid_request(AppErrorMessageId::ExportSelectedExportRangeIsInvalid)
    })?;
    let media_duration = u64::try_from(media.duration_micros).unwrap_or_default();
    if duration_micros == 0
        || duration_micros > PLAYBACK_PCM_MAX_CHUNK_MICROS
        || end_micros > media_duration
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportSelectedExportRangeIsInvalid,
        ));
    }

    let arguments = playback_chunk_arguments(&source.path, track, start_micros, duration_micros);
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        Duration::from_secs(30),
        PLAYBACK_PCM_MAX_OUTPUT_BYTES,
        STDERR_LIMIT,
        || {
            source.cancellation.load(Ordering::Acquire)
                || operation_cancellation.load(Ordering::Acquire)
        },
    )
    .map_err(process_error)?;

    if !output.status.success() || output.stdout_truncated || output.stdout.len() % 4 != 0 {
        return Err(AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
            diagnostics(&output, &source.path),
        ));
    }

    let samples = output
        .stdout
        .chunks_exact(2)
        .map(|sample| i16::from_le_bytes([sample[0], sample[1]]))
        .collect();
    Ok(PlaybackPcmChunk {
        channels: 2,
        sample_rate: PLAYBACK_PCM_SAMPLE_RATE,
        samples,
    })
}

fn playback_chunk_arguments(
    source_path: &Path,
    track: &AudioTrackSelection,
    start_micros: u64,
    duration_micros: u64,
) -> Vec<OsString> {
    let selection = std::slice::from_ref(track);
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-ss"),
        OsString::from(format_seconds(start_micros)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-t"),
        OsString::from(format_seconds(duration_micros)),
        OsString::from("-filter_complex"),
        OsString::from(audio_filter_graph(selection, false)),
        OsString::from("-map"),
        OsString::from("[audio0]"),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("s16le"),
        OsString::from("-acodec"),
        OsString::from("pcm_s16le"),
        OsString::from("-ar"),
        OsString::from(PLAYBACK_PCM_SAMPLE_RATE.to_string()),
        OsString::from("-ac"),
        OsString::from("2"),
        OsString::from("pipe:1"),
    ]
}

fn format_seconds(micros: u64) -> String {
    format!("{}.{:06}", micros / 1_000_000, micros % 1_000_000)
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::source_replaced(),
        io::ErrorKind::NotFound => AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegIsRequiredForPlayback,
            None::<String>,
        ),
        io::ErrorKind::TimedOut => AppError::preview_failed(
            AppErrorMessageId::MediaAudioPlaybackAudioDecodingTookTooLong,
            None::<String>,
        ),
        _ => AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
            None::<String>,
        ),
    }
}

fn diagnostics(output: &ProcessOutput, source_path: &Path) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr)
        .replace(source_path.to_string_lossy().as_ref(), "<source>");
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, path::Path};

    use crate::media::export::{AudioTrackProcessing, AudioTrackSelection};

    use super::{PLAYBACK_PCM_SAMPLE_RATE, playback_chunk_arguments};

    #[test]
    fn builds_bounded_pcm_chunk_arguments_without_shell_interpolation() {
        let track = AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 4,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects: Vec::new(),
            },
        };
        let arguments = playback_chunk_arguments(
            Path::new("C:\\Videos\\source clip.mkv"),
            &track,
            1_250_000,
            2_000_000,
        );

        assert_eq!(arguments[2], OsString::from("-ss"));
        assert_eq!(arguments[3], OsString::from("1.250000"));
        assert!(
            arguments
                .windows(2)
                .any(|pair| pair == [OsString::from("-t"), OsString::from("2.000000")])
        );
        assert!(
            arguments
                .windows(2)
                .any(|pair| pair == [OsString::from("-map"), OsString::from("[audio0]")])
        );
        assert!(arguments.windows(2).any(|pair| pair
            == [
                OsString::from("-ar"),
                OsString::from(PLAYBACK_PCM_SAMPLE_RATE.to_string())
            ]));
        assert_eq!(arguments.last(), Some(&OsString::from("pipe:1")));
    }
}
