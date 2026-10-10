use std::{
    ffi::{OsStr, OsString},
    fs,
    io::{self, Read, Write},
    path::Path,
    process,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use crate::{
    error::{AppError, AppErrorMessageId},
    media::export::{AudioTrackProcessing, waveform_signal_filter_chain},
    process::{ProcessOutput, run_bounded_cancellable, run_stream_cancellable},
    state::{WaveformArtifact, WaveformSource},
};

pub const MIN_WAVEFORM_WIDTH: u32 = 64;
pub const MAX_WAVEFORM_WIDTH: u32 = 4_096;
const WAVEFORM_FORMAT_VERSION: u16 = 2;
const WAVEFORM_HEADER_SIZE: usize = 12;
const WAVEFORM_FLAG_RLE: u16 = 1;
const WAVEFORM_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const WAVEFORM_STDOUT_LIMIT: usize = 16 * 1024;
const WAVEFORM_STDERR_LIMIT: usize = 512 * 1024;
const AUDIO_ACTIVITY_THRESHOLD_DB: f64 = -50.0;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);
pub type WaveformGenerationResult = (u32, Option<bool>, Result<WaveformArtifact, AppError>);

pub fn generate_waveforms(
    source: &WaveformSource,
    stream_indexes: &[u32],
    width: u32,
    processing_by_stream: &std::collections::HashMap<u32, AudioTrackProcessing>,
) -> Result<Vec<WaveformGenerationResult>, AppError> {
    for stream_index in stream_indexes {
        validate_waveform_request(&source.source.audio_stream_indexes, *stream_index, width)?;
    }
    let mut artifacts = stream_indexes
        .iter()
        .map(|stream_index| {
            create_artifact(*stream_index).map(|artifact| Some((*stream_index, artifact)))
        })
        .collect::<Result<Vec<_>, _>>()?;
    // Count samples and analyze activity first so every envelope column retains the same
    // sample boundaries as the former showwavespic pipeline.
    let activity_args =
        activity_arguments(&source.source.path, stream_indexes, processing_by_stream);
    let activity_output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &activity_args,
        WAVEFORM_TIMEOUT,
        WAVEFORM_STDOUT_LIMIT,
        WAVEFORM_STDERR_LIMIT,
        || waveform_cancelled(source),
    )
    .map_err(process_error)?;

    if !activity_output.status.success() {
        let failure_diagnostics = diagnostics(
            &activity_output,
            &source.source.path,
            artifacts
                .iter()
                .filter_map(Option::as_ref)
                .map(|(_, artifact)| artifact.path()),
        );
        return Ok(artifacts
            .into_iter()
            .map(|artifact| {
                let (stream_index, artifact) = artifact.expect("waveform artifact is present");
                waveform_error_result(
                    stream_index,
                    artifact,
                    AppErrorMessageId::MediaWaveformAnalysisFailed,
                    failure_diagnostics.clone(),
                )
            })
            .collect());
    }

    let activities = parse_audio_activity(&activity_output.stderr, stream_indexes);
    let sample_counts = parse_audio_sample_counts(&activity_output.stderr, stream_indexes);
    let mut results: Vec<Option<WaveformGenerationResult>> = std::iter::repeat_with(|| None)
        .take(stream_indexes.len())
        .collect();
    for (position, stream_index) in stream_indexes.iter().enumerate() {
        let Some(sample_count) = sample_counts.get(stream_index).copied().flatten() else {
            let (_, artifact) = artifacts[position]
                .take()
                .expect("waveform artifact is present");
            results[position] = Some(waveform_error_result(
                *stream_index,
                artifact,
                AppErrorMessageId::MediaWaveformSampleCountUnavailable,
                None,
            ));
            continue;
        };

        if sample_count < u64::from(width) {
            let (_, artifact) = artifacts[position]
                .take()
                .expect("waveform artifact is present");
            results[position] = Some(waveform_error_result(
                *stream_index,
                artifact,
                AppErrorMessageId::MediaWaveformTooFewSamples,
                None,
            ));
            continue;
        }

        let processing = processing_by_stream
            .get(stream_index)
            .expect("every waveform stream has processing settings");
        let arguments = pcm_stream_arguments(&source.source.path, *stream_index, processing);
        let output_path = artifacts[position]
            .as_ref()
            .expect("waveform artifact is present")
            .1
            .path()
            .to_owned();
        let diagnostics_path = output_path.clone();
        let sample_total = sample_count;
        let output_width = width;
        let ((), pcm_output) = run_stream_cancellable(
            OsStr::new("ffmpeg"),
            &arguments,
            WAVEFORM_TIMEOUT,
            WAVEFORM_STDERR_LIMIT,
            || waveform_cancelled(source),
            move |reader| {
                let mut output = fs::File::create(output_path)?;
                write_binned_pcm(reader, &mut output, sample_total, output_width)
            },
        )
        .map_err(process_error)?;

        if !pcm_output.status.success() {
            let failure_diagnostics = diagnostics(
                &pcm_output,
                &source.source.path,
                [diagnostics_path.as_path()],
            );
            let (_, artifact) = artifacts[position]
                .take()
                .expect("waveform artifact is present");
            results[position] = Some(waveform_error_result(
                *stream_index,
                artifact,
                AppErrorMessageId::MediaWaveformSampleReductionFailed,
                failure_diagnostics,
            ));
            continue;
        }

        let (stream_index, artifact) = artifacts[position]
            .take()
            .expect("waveform artifact is present");
        results[position] = Some((
            stream_index,
            activities.get(&stream_index).copied().flatten(),
            Ok(artifact),
        ));
    }

    Ok(results
        .into_iter()
        .map(|result| result.expect("every waveform stream has a result"))
        .collect())
}

fn waveform_cancelled(source: &WaveformSource) -> bool {
    source.source.cancellation.load(Ordering::Acquire)
        || source.cancellation.load(Ordering::Acquire)
}

pub fn validate_waveform_request(
    audio_stream_indexes: &[u32],
    stream_index: u32,
    width: u32,
) -> Result<(), AppError> {
    if !(MIN_WAVEFORM_WIDTH..=MAX_WAVEFORM_WIDTH).contains(&width) {
        return Err(
            AppError::invalid_request(AppErrorMessageId::MediaWaveformWidthOutOfRange)
                .with_arg("minWidth", MIN_WAVEFORM_WIDTH)
                .with_arg("maxWidth", MAX_WAVEFORM_WIDTH),
        );
    }
    if !audio_stream_indexes.contains(&stream_index) {
        return Err(AppError::invalid_request(
            AppErrorMessageId::MediaWaveformStreamDoesNotBelongToSource,
        )
        .with_arg("streamIndex", stream_index));
    }
    Ok(())
}

fn activity_arguments(
    source_path: &Path,
    stream_indexes: &[u32],
    processing_by_stream: &std::collections::HashMap<u32, AudioTrackProcessing>,
) -> Vec<OsString> {
    let filters = stream_indexes
        .iter()
        .enumerate()
        .map(|(index, stream_index)| {
            let effects = waveform_signal_filter_chain(
                processing_by_stream
                    .get(stream_index)
                    .expect("every waveform stream has processing settings"),
            );
            let effect_chain = if effects.is_empty() { String::new() } else { format!("{effects},") };
            format!("[0:{stream_index}]{effect_chain}aformat=sample_fmts=s16:channel_layouts=mono,volumedetect@stream{stream_index}[activity{index}]")
        })
        .collect::<Vec<_>>()
        .join(";");
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-nostats"),
        OsString::from("-filter_complex_threads"),
        OsString::from("1"),
        OsString::from("-threads"),
        OsString::from("1"),
        OsString::from("-n"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-filter_complex"),
        OsString::from(filters),
    ];
    for index in 0..stream_indexes.len() {
        arguments.extend([
            OsString::from("-map"),
            OsString::from(format!("[activity{index}]")),
            OsString::from("-f"),
            OsString::from("null"),
            OsString::from("-"),
        ]);
    }
    arguments
}

fn pcm_stream_arguments(
    source_path: &Path,
    stream_index: u32,
    processing: &AudioTrackProcessing,
) -> Vec<OsString> {
    let effects = waveform_signal_filter_chain(processing);
    let effect_chain = if effects.is_empty() {
        String::new()
    } else {
        format!("{effects},")
    };
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-nostats"),
        OsString::from("-threads"),
        OsString::from("1"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-filter_complex"),
        OsString::from(format!(
            "[0:{stream_index}]{effect_chain}aformat=sample_fmts=s16:channel_layouts=stereo[pcm]"
        )),
        OsString::from("-map"),
        OsString::from("[pcm]"),
        OsString::from("-c:a"),
        OsString::from("pcm_s16le"),
        OsString::from("-f"),
        OsString::from("s16le"),
        OsString::from("pipe:1"),
    ]
}

fn write_envelope_header(writer: &mut dyn Write, width: u32, flags: u16) -> io::Result<()> {
    let mut header = [0; WAVEFORM_HEADER_SIZE];
    header[..4].copy_from_slice(b"ETWF");
    header[4..6].copy_from_slice(&WAVEFORM_FORMAT_VERSION.to_le_bytes());
    header[6..8].copy_from_slice(&flags.to_le_bytes());
    header[8..].copy_from_slice(&width.to_le_bytes());
    writer.write_all(&header)
}

fn write_binned_pcm(
    reader: &mut dyn Read,
    writer: &mut dyn Write,
    sample_count: u64,
    width: u32,
) -> io::Result<()> {
    let width = u64::from(width);
    if sample_count < width {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "audio sample count is smaller than waveform width",
        ));
    }

    let samples_per_column = sample_count / width;
    let remainder = sample_count % width;
    let mut buffer = [0_u8; 16 * 1024];
    let mut envelope = Vec::with_capacity(width as usize * 4);

    // Keep showwavespic's existing column boundaries: each column gets the integer
    // quotient, then the remainder is assigned to the final column.
    for column in 0..width {
        let mut remaining = samples_per_column + u64::from(column == width - 1) * remainder;
        let total_samples = remaining;
        let mut square_sum = [0_u64; 2];
        let mut peak = [0_u32; 2];
        while remaining > 0 {
            let frames = remaining.min((buffer.len() / 4) as u64) as usize;
            let bytes = &mut buffer[..frames * 4];
            reader.read_exact(bytes)?;
            for frame in bytes.chunks_exact(4) {
                for (channel, sample) in frame.chunks_exact(2).enumerate() {
                    let value = i16::from_le_bytes([sample[0], sample[1]]) as i32;
                    let magnitude = value.unsigned_abs();
                    peak[channel] = peak[channel].max(magnitude);
                    square_sum[channel] += u64::from(magnitude) * u64::from(magnitude);
                }
            }
            remaining -= frames as u64;
        }

        for channel in 0..2 {
            let rms = (square_sum[channel] as f64 / total_samples as f64).sqrt();
            envelope.push(scale_amplitude(f64::from(peak[channel])));
            envelope.push(scale_amplitude(rms));
        }
    }

    let mut trailing = [0_u8; 1];
    if reader.read(&mut trailing)? != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "decoded audio sample count did not match the analyzed count",
        ));
    }
    let encoded = encode_rle(&envelope);
    let flags = if encoded.len() < envelope.len() {
        WAVEFORM_FLAG_RLE
    } else {
        0
    };
    write_envelope_header(writer, width as u32, flags)?;
    writer.write_all(if flags == WAVEFORM_FLAG_RLE {
        &encoded
    } else {
        &envelope
    })?;
    writer.flush()
}

fn scale_amplitude(amplitude: f64) -> u8 {
    ((amplitude / 32_768.0) * f64::from(u8::MAX)).round() as u8
}

fn encode_rle(samples: &[u8]) -> Vec<u8> {
    let mut encoded = Vec::with_capacity(samples.len());
    let mut position = 0;
    while position < samples.len() {
        let run_length = repeated_sample_count(samples, position);
        if run_length >= 3 {
            encoded.push(0x80 | (run_length - 1) as u8);
            encoded.push(samples[position]);
            position += run_length;
            continue;
        }

        let literal_start = position;
        position += run_length;
        while position < samples.len() && position - literal_start < 128 {
            let next_run_length = repeated_sample_count(samples, position);
            if next_run_length >= 3 {
                break;
            }
            position += next_run_length.min(128 - (position - literal_start));
        }
        let literal_length = position - literal_start;
        encoded.push((literal_length - 1) as u8);
        encoded.extend_from_slice(&samples[literal_start..position]);
    }
    encoded
}

fn repeated_sample_count(samples: &[u8], start: usize) -> usize {
    let value = samples[start];
    samples[start..]
        .iter()
        .take_while(|sample| **sample == value)
        .take(128)
        .count()
}

fn parse_audio_activity(
    stderr: &[u8],
    stream_indexes: &[u32],
) -> std::collections::HashMap<u32, Option<bool>> {
    let stderr = String::from_utf8_lossy(stderr);
    stream_indexes
        .iter()
        .map(|stream_index| {
            let marker = format!("[volumedetect@stream{stream_index} ");
            let mean_volume = stderr.lines().find_map(|line| {
                if !line.contains(&marker) {
                    return None;
                }
                parse_mean_volume(line.as_bytes())
            });
            (*stream_index, mean_volume.map(is_mean_volume_audible))
        })
        .collect()
}

fn parse_audio_sample_counts(
    stderr: &[u8],
    stream_indexes: &[u32],
) -> std::collections::HashMap<u32, Option<u64>> {
    let stderr = String::from_utf8_lossy(stderr);
    stream_indexes
        .iter()
        .map(|stream_index| {
            let marker = format!("[volumedetect@stream{stream_index} ");
            let sample_count = stderr.lines().rev().find_map(|line| {
                if !line.contains(&marker) {
                    return None;
                }
                line.split_once("n_samples:")?.1.trim().parse().ok()
            });
            (*stream_index, sample_count)
        })
        .collect()
}

fn waveform_error_result(
    stream_index: u32,
    _artifact: WaveformArtifact,
    message_id: AppErrorMessageId,
    diagnostics: Option<String>,
) -> WaveformGenerationResult {
    (
        stream_index,
        None,
        Err(AppError::waveform_failed(message_id, diagnostics)
            .with_arg("streamIndex", stream_index)),
    )
}

fn parse_mean_volume(stderr: &[u8]) -> Option<f64> {
    String::from_utf8_lossy(stderr).lines().find_map(|line| {
        let value = line.split_once("mean_volume:")?.1.trim();
        let value = value.split_whitespace().next()?;
        if value.eq_ignore_ascii_case("-inf") {
            Some(f64::NEG_INFINITY)
        } else {
            value.parse().ok()
        }
    })
}

fn is_mean_volume_audible(mean_volume: f64) -> bool {
    mean_volume >= AUDIO_ACTIVITY_THRESHOLD_DB
}

fn create_artifact(stream_index: u32) -> Result<WaveformArtifact, AppError> {
    create_temporary_artifact(stream_index, "etwf")
}

fn create_temporary_artifact(
    stream_index: u32,
    extension: &str,
) -> Result<WaveformArtifact, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let base_directory = std::env::temp_dir();

    for _ in 0..100 {
        let sequence = NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
        let directory = base_directory.join(format!(
            "easytrim-waveform-{}-{timestamp}-{sequence}",
            process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => {
                let path = directory.join(format!("audio-{stream_index}.{extension}"));
                return WaveformArtifact::new(directory, path);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(_) => {
                return Err(AppError::io_failed(
                    AppErrorMessageId::MediaWaveformTemporaryWaveformDirectoryCouldNotBeCreated,
                ));
            }
        }
    }

    Err(AppError::io_failed(
        AppErrorMessageId::MediaWaveformUniqueTemporaryWaveformDirectoryCouldNotBeCreated,
    ))
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => {
            AppError::cancelled(AppErrorMessageId::MediaWaveformWaveformGenerationWasReplaced)
        }
        io::ErrorKind::NotFound => AppError::waveform_failed(
            AppErrorMessageId::MediaWaveformFfmpegIsRequiredToGenerateAudioWaveforms,
            None::<String>,
        ),
        io::ErrorKind::TimedOut => AppError::waveform_failed(
            AppErrorMessageId::MediaWaveformWaveformGenerationTookTooLong,
            None::<String>,
        ),
        _ => AppError::waveform_failed(
            AppErrorMessageId::MediaWaveformFfmpegCouldNotGenerateTheAudioWaveform,
            None::<String>,
        ),
    }
}

fn diagnostics<'a>(
    output: &ProcessOutput,
    source_path: &Path,
    waveform_paths: impl IntoIterator<Item = &'a Path>,
) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr);
    let mut value = value.replace(source_path.to_string_lossy().as_ref(), "<source>");
    for waveform_path in waveform_paths {
        value = value.replace(waveform_path.to_string_lossy().as_ref(), "<waveform>");
    }
    let value = value.trim();
    (!value.is_empty()).then(|| {
        if output.stderr_truncated {
            format!("{value}\n[diagnostics truncated]")
        } else {
            value.to_owned()
        }
    })
}

#[cfg(test)]
mod tests {
    use std::{
        ffi::OsString,
        io::Cursor,
        path::Path,
        sync::{Arc, atomic::AtomicBool},
    };

    use crate::{
        media::export::{AudioTrackSignalEffect, NoiseReductionPreset},
        state::{ActiveSource, WaveformSource},
    };

    use super::{
        AudioTrackProcessing, MAX_WAVEFORM_WIDTH, MIN_WAVEFORM_WIDTH, activity_arguments,
        encode_rle, parse_audio_sample_counts, pcm_stream_arguments, validate_waveform_request,
        write_binned_pcm, write_envelope_header,
    };

    fn empty_processing() -> AudioTrackProcessing {
        AudioTrackProcessing {
            gain_db: 0.0,
            loudness_normalization: None,
            effects: Vec::new(),
        }
    }

    #[test]
    fn validates_global_audio_stream_indexes_and_bounded_widths() {
        assert!(validate_waveform_request(&[2, 4], 2, 1_200).is_ok());
        assert!(validate_waveform_request(&[2, 4], 3, 1_200).is_err());
        assert!(validate_waveform_request(&[2], 2, MIN_WAVEFORM_WIDTH - 1).is_err());
        assert!(validate_waveform_request(&[2], 2, MAX_WAVEFORM_WIDTH + 1).is_err());
    }

    #[test]
    fn builds_counting_and_streaming_commands() {
        let source_path = Path::new("C:\\Videos\\source clip.mkv");
        let processing_by_stream = [(2, empty_processing()), (4, empty_processing())]
            .into_iter()
            .collect();
        let activity_args = activity_arguments(source_path, &[2, 4], &processing_by_stream);
        assert!(activity_args.windows(2).any(|pair| {
            pair == [
                OsString::from("-i"),
                OsString::from("C:\\Videos\\source clip.mkv"),
            ]
        }));
        assert!(activity_args.iter().any(|argument| {
            argument
                == "[0:2]aformat=sample_fmts=s16:channel_layouts=mono,volumedetect@stream2[activity0];[0:4]aformat=sample_fmts=s16:channel_layouts=mono,volumedetect@stream4[activity1]"
        }));
        assert_eq!(
            activity_args
                .windows(2)
                .filter(|pair| pair[0] == "-map")
                .map(|pair| pair[1].clone())
                .collect::<Vec<_>>(),
            [OsString::from("[activity0]"), OsString::from("[activity1]")]
        );

        let pcm_args = pcm_stream_arguments(source_path, 4, &empty_processing());
        assert!(pcm_args.iter().any(|argument| {
            argument == "[0:4]aformat=sample_fmts=s16:channel_layouts=stereo[pcm]"
        }));
        assert_eq!(pcm_args.last().unwrap(), "pipe:1");
    }

    #[test]
    fn applies_signal_effects_before_waveform_analysis_and_sampling() {
        let source_path = Path::new("C:\\Videos\\source clip.mkv");
        let processing = AudioTrackProcessing {
            effects: vec![
                AudioTrackSignalEffect::HighPass {
                    cutoff_hz: 100.0,
                    stage: crate::media::export::AudioProcessingStage::Cleanup,
                },
                AudioTrackSignalEffect::NoiseReduction {
                    preset: NoiseReductionPreset::Medium,
                    stage: crate::media::export::AudioProcessingStage::Cleanup,
                },
                AudioTrackSignalEffect::Limiter {
                    ceiling_db: -1.0,
                    stage: crate::media::export::AudioProcessingStage::FinalProtection,
                },
            ],
            ..empty_processing()
        };
        let processing_by_stream = [(4, processing.clone())].into_iter().collect();
        let activity_args = activity_arguments(source_path, &[4], &processing_by_stream);
        let pcm_args = pcm_stream_arguments(source_path, 4, &processing);

        assert!(activity_args.iter().any(|argument| {
            argument == "[0:4]highpass=f=100.000,afftdn=nr=12:nf=-35,aformat=sample_fmts=s16:channel_layouts=mono,volumedetect@stream4[activity0]"
        }));
        assert!(
            activity_args
                .iter()
                .all(|argument| !argument.to_string_lossy().contains("alimiter"))
        );
        assert!(pcm_args.iter().any(|argument| {
            argument == "[0:4]highpass=f=100.000,afftdn=nr=12:nf=-35,aformat=sample_fmts=s16:channel_layouts=stereo[pcm]"
        }));
        assert!(
            pcm_args
                .iter()
                .all(|argument| !argument.to_string_lossy().contains("alimiter"))
        );
    }

    #[test]
    fn parses_activity_by_filter_instance_and_classifies_noise() {
        let stderr = b"[volumedetect@stream4 @ 0x0] n_samples: 0\n[volumedetect@stream4 @ 0x0] n_samples: 96000\n[volumedetect@stream4 @ 0x0] mean_volume: -91.0 dB\n[volumedetect@stream2 @ 0x0] n_samples: 0\n[volumedetect@stream2 @ 0x0] n_samples: 48000\n[volumedetect@stream2 @ 0x0] mean_volume: -18.5 dB";
        let activity = super::parse_audio_activity(stderr, &[2, 4, 6]);
        let counts = parse_audio_sample_counts(stderr, &[2, 4, 6]);
        assert_eq!(activity.get(&2).copied(), Some(Some(true)));
        assert_eq!(activity.get(&4).copied(), Some(Some(false)));
        assert_eq!(activity.get(&6).copied(), Some(None));
        assert_eq!(counts.get(&2).copied(), Some(Some(48_000)));
        assert_eq!(counts.get(&4).copied(), Some(Some(96_000)));
        assert_eq!(counts.get(&6).copied(), Some(None));
    }

    #[test]
    fn sample_binning_preserves_peak_and_rms_for_each_stereo_channel() {
        let samples = [100_i16, 1_000, 200, 0, 300, 0, 400, 0];
        let mut source = Cursor::new(
            samples
                .iter()
                .flat_map(|sample| sample.to_le_bytes())
                .collect::<Vec<_>>(),
        );
        let mut output = Vec::new();

        write_binned_pcm(&mut source, &mut output, 4, 2)
            .expect("samples are reduced into four buckets");

        assert_eq!(&output[..4], b"ETWF");
        assert_eq!(u16::from_le_bytes([output[4], output[5]]), 2);
        assert_eq!(&output[12..], [2, 1, 8, 6, 3, 3, 0, 0]);
    }

    #[test]
    fn writes_versioned_width_header_before_unsigned_amplitudes() {
        let mut output = Vec::new();
        write_envelope_header(&mut output, 1_280, 0).expect("header is written");
        assert_eq!(&output[..4], b"ETWF");
        assert_eq!(u16::from_le_bytes([output[4], output[5]]), 2);
        assert_eq!(u16::from_le_bytes(output[6..8].try_into().unwrap()), 0);
        assert_eq!(u32::from_le_bytes(output[8..12].try_into().unwrap()), 1_280);
        assert_eq!(output.len(), super::WAVEFORM_HEADER_SIZE);
    }

    #[test]
    fn compresses_repeated_envelope_samples_without_expanding_literals() {
        assert_eq!(encode_rle(&[0, 0, 0, 0, 0]), [0x84, 0]);
        assert_eq!(encode_rle(&[1, 2, 3]), [2, 1, 2, 3]);
    }

    fn decode_rle(samples: &[u8], expected_len: usize) -> Vec<u8> {
        let mut decoded = Vec::with_capacity(expected_len);
        let mut position = 0;
        while position < samples.len() {
            let token = samples[position];
            position += 1;
            let length = usize::from(token & 0x7f) + 1;
            if token & 0x80 != 0 {
                let value = samples[position];
                position += 1;
                decoded.extend(std::iter::repeat_n(value, length));
            } else {
                decoded.extend_from_slice(&samples[position..position + length]);
                position += length;
            }
        }
        assert_eq!(decoded.len(), expected_len);
        decoded
    }

    #[test]
    #[ignore = "requires FFmpeg; compares a two-minute six-stream envelope with PNG references"]
    fn envelopes_match_legacy_waveform_shape_for_active_and_silent_streams() {
        use crate::process::run_bounded;
        use std::{
            ffi::OsStr,
            fs,
            time::{Duration, Instant},
        };

        let source = super::create_artifact(99).unwrap();
        let mut fixture_args: Vec<OsString> = [
            "-hide_banner",
            "-nostdin",
            "-nostats",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=1000:sample_rate=48000:duration=120",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=48000:cl=mono:d=120",
            "-map",
            "0:a",
            "-map",
            "1:a",
            "-map",
            "0:a",
            "-map",
            "1:a",
            "-map",
            "0:a",
            "-map",
            "1:a",
            "-ac:a",
            "2",
            "-c:a",
            "flac",
            "-threads",
            "1",
            "-f",
            "matroska",
        ]
        .iter()
        .map(OsString::from)
        .collect();
        fixture_args.push(source.path().as_os_str().to_owned());
        let fixture = run_bounded(
            OsStr::new("ffmpeg"),
            &fixture_args,
            Duration::from_secs(60),
            0,
            16384,
        )
        .unwrap();
        assert!(
            fixture.status.success(),
            "{}",
            String::from_utf8_lossy(&fixture.stderr)
        );

        let references = (0..6)
            .map(|index| super::create_artifact(index).unwrap())
            .collect::<Vec<_>>();
        let indexes = [0, 1, 2, 3, 4, 5];
        let filters = indexes
            .iter()
            .enumerate()
            .map(|(position, stream_index)| {
                format!(
                    "[0:{stream_index}]aformat=channel_layouts=mono,showwavespic=s=1280x56:colors=0x8b5cf6:scale=lin[waveform{position}]"
                )
            })
            .collect::<Vec<_>>()
            .join(";");
        let mut args: Vec<OsString> = [
            "-hide_banner",
            "-nostdin",
            "-filter_complex_threads",
            "1",
            "-threads",
            "1",
            "-n",
            "-i",
        ]
        .iter()
        .map(OsString::from)
        .collect();
        args.push(source.path().as_os_str().to_owned());
        args.extend([OsString::from("-filter_complex"), OsString::from(filters)]);
        for (position, reference) in references.iter().enumerate() {
            args.extend([
                OsString::from("-map"),
                OsString::from(format!("[waveform{position}]")),
                OsString::from("-frames:v"),
                OsString::from("1"),
                OsString::from("-c:v"),
                OsString::from("png"),
                OsString::from("-update"),
                OsString::from("1"),
                OsString::from("-f"),
                OsString::from("image2"),
                reference.path().as_os_str().to_owned(),
            ]);
        }
        let legacy_render_started = Instant::now();
        let output = run_bounded(
            OsStr::new("ffmpeg"),
            &args,
            Duration::from_secs(60),
            0,
            16384,
        )
        .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let legacy_render_elapsed = legacy_render_started.elapsed();
        let cancellation = Arc::new(AtomicBool::new(false));
        let waveform_source = WaveformSource {
            source: ActiveSource {
                load_token: 1,
                path: source.path().to_owned(),
                cancellation: cancellation.clone(),
                media: None,
                preview_streams: None,
                audio_stream_indexes: indexes.to_vec(),
            },
            cancellation,
        };
        let processing_by_stream = indexes
            .iter()
            .map(|stream_index| (*stream_index, empty_processing()))
            .collect();
        let generation_started = Instant::now();
        let generated =
            super::generate_waveforms(&waveform_source, &indexes, 1280, &processing_by_stream)
                .unwrap();
        let generation_elapsed = generation_started.elapsed();
        let mut total_envelope_bytes = 0;
        let mut total_reference_bytes = 0;
        for (position, ((stream_index, has_signal, result), reference)) in
            generated.iter().zip(&references).enumerate()
        {
            assert_eq!(*stream_index, position as u32);
            assert_eq!(*has_signal, Some(position % 2 == 0));
            let artifact = result.as_ref().expect("waveform generation succeeds");
            let envelope = fs::read(artifact.path()).unwrap();
            let reference_image = fs::read(reference.path()).unwrap();
            assert_eq!(&envelope[..4], b"ETWF");
            assert_eq!(u16::from_le_bytes(envelope[4..6].try_into().unwrap()), 2);
            let flags = u16::from_le_bytes(envelope[6..8].try_into().unwrap());
            assert_eq!(
                u32::from_le_bytes(envelope[8..12].try_into().unwrap()),
                1280
            );
            assert!(envelope.len() <= 12 + 1280 * 4);
            assert_eq!(&reference_image[..8], b"\x89PNG\r\n\x1a\n");
            assert_eq!(
                u32::from_be_bytes(reference_image[16..20].try_into().unwrap()),
                1280
            );
            assert_eq!(
                u32::from_be_bytes(reference_image[20..24].try_into().unwrap()),
                56
            );

            let values = if flags == super::WAVEFORM_FLAG_RLE {
                decode_rle(&envelope[12..], 1280 * 4)
            } else {
                envelope[12..].to_vec()
            };
            if position % 2 == 0 {
                assert!(values.chunks_exact(4).all(|bin| bin[0] > 0 && bin[1] > 0));
            } else {
                assert!(values.iter().all(|amplitude| *amplitude == 0));
            }

            let decoded_reference = run_bounded(
                OsStr::new("ffmpeg"),
                &[
                    OsString::from("-hide_banner"),
                    OsString::from("-v"),
                    OsString::from("error"),
                    OsString::from("-i"),
                    reference.path().as_os_str().to_owned(),
                    OsString::from("-f"),
                    OsString::from("rawvideo"),
                    OsString::from("-pix_fmt"),
                    OsString::from("rgb24"),
                    OsString::from("pipe:1"),
                ],
                Duration::from_secs(60),
                1280 * 56 * 3,
                16384,
            )
            .unwrap();
            assert!(decoded_reference.status.success());
            assert_eq!(decoded_reference.stdout.len(), 1280 * 56 * 3);
            for (column, bin) in values.chunks_exact(4).enumerate() {
                let amplitude = bin[0];
                let actual_half_height = decoded_reference
                    .stdout
                    .chunks_exact(1280 * 3)
                    .enumerate()
                    .filter_map(|(row, pixels)| {
                        let pixel = &pixels[column * 3..column * 3 + 3];
                        (pixel[2] > pixel[0] && pixel[2] > pixel[1]).then_some(row.abs_diff(28))
                    })
                    .max()
                    .unwrap_or(0);
                let expected_half_height =
                    (f64::from(amplitude) / f64::from(u8::MAX) * 28.0).round() as usize;
                assert!(
                    actual_half_height.abs_diff(expected_half_height) <= 2,
                    "stream {stream_index}, column {column}: PNG half-height {actual_half_height}, envelope half-height {expected_half_height}"
                );
            }
            total_envelope_bytes += envelope.len();
            total_reference_bytes += reference_image.len();
        }

        let short_source = super::create_artifact(98).unwrap();
        let short_fixture = run_bounded(
            OsStr::new("ffmpeg"),
            &[
                OsString::from("-hide_banner"),
                OsString::from("-nostdin"),
                OsString::from("-f"),
                OsString::from("lavfi"),
                OsString::from("-i"),
                OsString::from("sine=frequency=1000:sample_rate=48000:duration=3"),
                OsString::from("-c:a"),
                OsString::from("flac"),
                OsString::from("-f"),
                OsString::from("matroska"),
                short_source.path().as_os_str().to_owned(),
            ],
            Duration::from_secs(60),
            0,
            16384,
        )
        .unwrap();
        assert!(short_fixture.status.success());
        let short_reference = super::create_artifact(98).unwrap();
        let short_legacy_started = Instant::now();
        let short_legacy = run_bounded(
            OsStr::new("ffmpeg"),
            &[
                OsString::from("-hide_banner"),
                OsString::from("-nostdin"),
                OsString::from("-filter_complex_threads"),
                OsString::from("1"),
                OsString::from("-i"),
                short_source.path().as_os_str().to_owned(),
                OsString::from("-filter_complex"),
                OsString::from("[0:0]aformat=channel_layouts=mono,showwavespic=s=1280x56:colors=0x8b5cf6:scale=sqrt[waveform]"),
                OsString::from("-map"),
                OsString::from("[waveform]"),
                OsString::from("-frames:v"),
                OsString::from("1"),
                OsString::from("-c:v"),
                OsString::from("png"),
                OsString::from("-f"),
                OsString::from("image2"),
                short_reference.path().as_os_str().to_owned(),
            ],
            Duration::from_secs(60),
            0,
            16384,
        )
        .unwrap();
        assert!(short_legacy.status.success());
        let short_legacy_elapsed = short_legacy_started.elapsed();
        let short_cancellation = Arc::new(AtomicBool::new(false));
        let short_waveform_source = WaveformSource {
            source: ActiveSource {
                load_token: 2,
                path: short_source.path().to_owned(),
                cancellation: short_cancellation.clone(),
                media: None,
                preview_streams: None,
                audio_stream_indexes: vec![0],
            },
            cancellation: short_cancellation,
        };
        let short_processing = [(0, empty_processing())].into_iter().collect();
        let short_generation_started = Instant::now();
        let short_generated =
            super::generate_waveforms(&short_waveform_source, &[0], 1280, &short_processing)
                .unwrap();
        let short_generation_elapsed = short_generation_started.elapsed();
        let short_artifact = short_generated[0]
            .2
            .as_ref()
            .expect("short waveform generation succeeds");
        eprintln!(
            "waveform benchmark fixture: one stream, 3 seconds; legacy PNG render {:?} ({} bytes); envelope generation {:?} ({} bytes)",
            short_legacy_elapsed,
            fs::metadata(short_reference.path()).unwrap().len(),
            short_generation_elapsed,
            fs::metadata(short_artifact.path()).unwrap().len()
        );
        eprintln!(
            "waveform benchmark fixture: six streams, 120 seconds; legacy PNG render {:?}; envelope generation {:?}; compact artifacts {} bytes; PNG reference artifacts {} bytes",
            legacy_render_elapsed, generation_elapsed, total_envelope_bytes, total_reference_bytes
        );
    }
}
