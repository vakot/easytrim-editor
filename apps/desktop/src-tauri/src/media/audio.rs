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
    media::{
        audio_filters::{
            compiler::{CANONICAL_SAMPLE_RATE, CompiledChain, compile_chain},
            model::AudioChainSelection,
        },
        export::validate_audio_stream,
    },
    process::{ProcessOutput, run_bounded_cancellable},
    state::ActiveSource,
};

const STDERR_LIMIT: usize = 128 * 1024;
pub const PLAYBACK_PCM_CHANNELS: usize = 2;
pub const PLAYBACK_PCM_MAX_CHUNK_MICROS: u64 = 2_000_000;
const PLAYBACK_PCM_FILTER_PREROLL_MICROS: u64 = 2_000_000;
const PLAYBACK_PCM_BYTES_PER_FRAME: usize = PLAYBACK_PCM_CHANNELS * std::mem::size_of::<f32>();
const PLAYBACK_PCM_MAX_OUTPUT_BYTES: usize =
    CANONICAL_SAMPLE_RATE as usize * 2 * PLAYBACK_PCM_BYTES_PER_FRAME;

/// Decodes one processed playback chunk as interleaved little-endian f32 stereo at 48 kHz.
///
/// Float samples keep peaks above full scale intact so the WebAudio Track Volume applied after
/// this chunk can still attenuate them.
pub fn decode_playback_chunk(
    source: &ActiveSource,
    track: &AudioChainSelection,
    start_micros: u64,
    duration_micros: u64,
    operation_cancellation: Arc<AtomicBool>,
) -> Result<Vec<u8>, AppError> {
    let media = source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request(
            AppErrorMessageId::MediaAudioPlaybackChunkRequiresInspectedSourceMedia,
        )
    })?;
    validate_audio_stream(media, track.stream_index)?;
    let chain = compile_chain(&track.filters, &track.loudness_measurements)?;
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

    let arguments = playback_chunk_arguments(
        &source.path,
        track.stream_index,
        &chain,
        start_micros,
        duration_micros,
    );
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

    let expected_output_bytes =
        micros_to_frames(duration_micros) as usize * PLAYBACK_PCM_BYTES_PER_FRAME;
    if !output.status.success()
        || output.stdout_truncated
        || output.stdout.len() > expected_output_bytes
        || output.stdout.len() % PLAYBACK_PCM_BYTES_PER_FRAME != 0
    {
        return Err(AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
            diagnostics(&output, &source.path),
        ));
    }

    Ok(output.stdout)
}

fn playback_chunk_arguments(
    source_path: &Path,
    stream_index: u32,
    chain: &CompiledChain,
    start_micros: u64,
    duration_micros: u64,
) -> Vec<OsString> {
    let seek_micros = start_micros.saturating_sub(PLAYBACK_PCM_FILTER_PREROLL_MICROS);
    let filter_preroll_frames = micros_to_frames(start_micros - seek_micros);
    let requested_frames = micros_to_frames(duration_micros);
    let filter_graph = format!(
        "[0:{stream_index}]{},apad=whole_len={},atrim=start_sample={filter_preroll_frames}:end_sample={},asetpts=PTS-STARTPTS[audio_chunk]",
        chain.canonical_graph(),
        filter_preroll_frames + requested_frames,
        filter_preroll_frames + requested_frames,
    );
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-ss"),
        OsString::from(format_seconds(seek_micros)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-t"),
        OsString::from(format_seconds(start_micros - seek_micros + duration_micros)),
        OsString::from("-filter_complex"),
        OsString::from(filter_graph),
        OsString::from("-map"),
        OsString::from("[audio_chunk]"),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("f32le"),
        OsString::from("-acodec"),
        OsString::from("pcm_f32le"),
        OsString::from("-ar"),
        OsString::from(CANONICAL_SAMPLE_RATE.to_string()),
        OsString::from("-ac"),
        OsString::from(PLAYBACK_PCM_CHANNELS.to_string()),
        OsString::from("pipe:1"),
    ]
}

fn micros_to_frames(micros: u64) -> u64 {
    ((u128::from(micros) * u128::from(CANONICAL_SAMPLE_RATE) + 500_000) / 1_000_000) as u64
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

    use crate::media::audio_filters::{
        compiler::compile_chain,
        model::fixtures::high_pass,
        test_fixtures::{decode_f32_stereo, generate_fixture, max_difference},
    };

    use super::playback_chunk_arguments;

    #[test]
    fn builds_bounded_float_chunk_arguments_without_shell_interpolation() {
        let chain = compile_chain(&[high_pass("hp", 80.0)], &[]).unwrap();
        let arguments = playback_chunk_arguments(
            Path::new("C:\\Videos\\source clip.mkv"),
            4,
            &chain,
            1_250_000,
            2_000_000,
        );

        assert_eq!(arguments[2], OsString::from("-ss"));
        assert_eq!(arguments[3], OsString::from("0.000000"));
        assert!(
            arguments
                .windows(2)
                .any(|pair| pair == [OsString::from("-t"), OsString::from("3.250000")])
        );
        assert!(arguments.windows(2).any(|pair| {
            pair[0] == "-filter_complex"
                && pair[1]
                    == "[0:4]aresample=48000:async=1:first_pts=0,highpass=f=80,apad=whole_len=156000,atrim=start_sample=60000:end_sample=156000,asetpts=PTS-STARTPTS[audio_chunk]"
        }));
        assert!(
            arguments
                .windows(2)
                .any(|pair| pair == [OsString::from("-f"), OsString::from("f32le")])
        );
        assert_eq!(arguments.last(), Some(&OsString::from("pipe:1")));
    }

    #[test]
    fn timestamp_gaps_preserve_positions_across_independently_decoded_chunks() {
        let fixture = generate_fixture(
            "playback-timestamp-gap",
            "aevalsrc=0.31*sin(2*PI*440*t)+0.22*sin(2*PI*733*t)+0.1*sin(2*PI*1103*t):s=48000:d=8,asetpts=PTS+48000+gte(N\\,144384)*256",
            "nut",
            "pcm_s16le",
        );
        let source_path = fixture.path().as_os_str().to_owned();
        let expected_frames = 6 * 48_000;
        let reference = decode_f32_stereo(&[
            OsString::from("-i"),
            source_path.clone(),
            OsString::from("-filter_complex"),
            OsString::from(format!(
                "[0:a:0]aresample=48000:async=1:first_pts=0,apad=whole_len={expected_frames},atrim=end_sample={expected_frames},asetpts=PTS-STARTPTS[reference]"
            )),
            OsString::from("-map"),
            OsString::from("[reference]"),
        ]);
        assert_eq!(reference.len(), expected_frames * 2);
        assert_eq!(reference[0], 0.0);
        assert_ne!(reference[2], 0.0);

        let chain = compile_chain(&[], &[]).unwrap();
        let mut decoded_chunks = Vec::new();
        for start_micros in [0, 2_000_000, 4_000_000] {
            let mut arguments =
                playback_chunk_arguments(fixture.path(), 0, &chain, start_micros, 2_000_000);
            // decode_f32_stereo appends the same raw float output options.
            arguments.truncate(arguments.len() - 9);
            let chunk = decode_f32_stereo(&arguments[2..]);
            assert_eq!(chunk.len(), 2 * 48_000 * 2);
            decoded_chunks.extend(chunk);
        }

        let difference = max_difference(&reference, &decoded_chunks);
        assert!(
            difference < 1e-4,
            "timestamp-normalized chunks diverged from the absolute-position reference by {difference}"
        );
    }
}
