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
    error::AppError,
    media::export::{AudioTrackProcessing, waveform_signal_filter_chain},
    process::{ProcessOutput, run_bounded_cancellable, run_stream_cancellable},
    state::{WaveformArtifact, WaveformSource},
};

pub const MIN_WAVEFORM_WIDTH: u32 = 64;
pub const MAX_WAVEFORM_WIDTH: u32 = 4_096;
const WAVEFORM_HEIGHT: u32 = 56;
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
    // Count samples and analyze activity before the streaming render pass so each pixel
    // receives the same sample range as showwavespic's full-rate implementation.
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
                    "Waveform analysis failed",
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
    let mut envelopes = Vec::new();

    for (position, stream_index) in stream_indexes.iter().enumerate() {
        let Some(sample_count) = sample_counts.get(stream_index).copied().flatten() else {
            let (_, artifact) = artifacts[position]
                .take()
                .expect("waveform artifact is present");
            results[position] = Some(waveform_error_result(
                *stream_index,
                artifact,
                "FFmpeg did not report the audio sample count",
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
                "The audio stream has too few samples for its waveform width",
                None,
            ));
            continue;
        }

        let envelope = create_envelope_artifact(*stream_index)?;
        let processing = processing_by_stream
            .get(stream_index)
            .expect("every waveform stream has processing settings");
        let arguments = pcm_stream_arguments(&source.source.path, *stream_index, processing);
        let envelope_path = envelope.path().to_owned();
        let sample_total = sample_count;
        let output_width = width;
        let ((), pcm_output) = run_stream_cancellable(
            OsStr::new("ffmpeg"),
            &arguments,
            WAVEFORM_TIMEOUT,
            WAVEFORM_STDERR_LIMIT,
            || waveform_cancelled(source),
            move |reader| {
                let mut output = fs::File::create(envelope_path)?;
                write_binned_pcm(reader, &mut output, sample_total, output_width)
            },
        )
        .map_err(process_error)?;

        if !pcm_output.status.success() {
            let failure_diagnostics =
                diagnostics(&pcm_output, &source.source.path, [envelope.path()]);
            let (_, artifact) = artifacts[position]
                .take()
                .expect("waveform artifact is present");
            results[position] = Some(waveform_error_result(
                *stream_index,
                artifact,
                "Waveform sample reduction failed",
                failure_diagnostics,
            ));
            continue;
        }

        envelopes.push((position, *stream_index, envelope));
    }

    if !envelopes.is_empty() {
        let image_args = render_waveform_arguments(
            width,
            &envelopes
                .iter()
                .map(|(_, _, envelope)| envelope.path())
                .collect::<Vec<_>>(),
            &envelopes
                .iter()
                .map(|(position, _, _)| {
                    artifacts[*position]
                        .as_ref()
                        .expect("waveform artifact is present")
                        .1
                        .path()
                })
                .collect::<Vec<_>>(),
        );
        let image_output = run_bounded_cancellable(
            OsStr::new("ffmpeg"),
            &image_args,
            WAVEFORM_TIMEOUT,
            WAVEFORM_STDOUT_LIMIT,
            WAVEFORM_STDERR_LIMIT,
            || waveform_cancelled(source),
        )
        .map_err(process_error)?;

        if image_output.status.success() {
            for (position, _, _) in envelopes {
                let (stream_index, artifact) = artifacts[position]
                    .take()
                    .expect("waveform artifact is present");
                if artifact.path().is_file() {
                    results[position] = Some((
                        stream_index,
                        activities.get(&stream_index).copied().flatten(),
                        Ok(artifact),
                    ));
                } else {
                    results[position] = Some(waveform_error_result(
                        stream_index,
                        artifact,
                        "Waveform generation produced no image",
                        None,
                    ));
                }
            }
        } else {
            let failure_diagnostics = diagnostics(
                &image_output,
                &source.source.path,
                artifacts
                    .iter()
                    .filter_map(Option::as_ref)
                    .map(|(_, artifact)| artifact.path())
                    .chain(envelopes.iter().map(|(_, _, envelope)| envelope.path())),
            );
            for (position, stream_index, _) in envelopes {
                let (_, artifact) = artifacts[position]
                    .take()
                    .expect("waveform artifact is present");
                results[position] = Some(waveform_error_result(
                    stream_index,
                    artifact,
                    "Waveform image rendering failed",
                    failure_diagnostics.clone(),
                ));
            }
        }
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
        return Err(AppError::invalid_request(format!(
            "Waveform width must be between {MIN_WAVEFORM_WIDTH} and {MAX_WAVEFORM_WIDTH} pixels."
        )));
    }
    if !audio_stream_indexes.contains(&stream_index) {
        return Err(AppError::invalid_request(format!(
            "Audio stream #{stream_index} does not belong to the active source."
        )));
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
            "[0:{stream_index}]{effect_chain}aformat=sample_fmts=s16:channel_layouts=mono[pcm]"
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

fn render_waveform_arguments(
    width: u32,
    envelope_paths: &[&Path],
    output_paths: &[&Path],
) -> Vec<OsString> {
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-nostats"),
        OsString::from("-filter_complex_threads"),
        OsString::from("1"),
        OsString::from("-threads"),
        OsString::from("1"),
        OsString::from("-n"),
    ];
    for envelope_path in envelope_paths {
        arguments.extend([
            OsString::from("-f"),
            OsString::from("s16le"),
            OsString::from("-ar"),
            OsString::from(width.to_string()),
            OsString::from("-ac"),
            OsString::from("1"),
            OsString::from("-i"),
            envelope_path.as_os_str().to_owned(),
        ]);
    }

    let filters = (0..envelope_paths.len())
        .map(|index| {
            format!(
                "[{index}:a:0]showwavespic=s={width}x{WAVEFORM_HEIGHT}:colors=0x8b5cf6:scale=sqrt[waveform{index}]"
            )
        })
        .collect::<Vec<_>>()
        .join(";");
    arguments.extend([OsString::from("-filter_complex"), OsString::from(filters)]);
    for (index, output_path) in output_paths.iter().enumerate() {
        arguments.extend([
            OsString::from("-map"),
            OsString::from(format!("[waveform{index}]")),
            OsString::from("-frames:v"),
            OsString::from("1"),
            OsString::from("-c:v"),
            OsString::from("png"),
            OsString::from("-update"),
            OsString::from("1"),
            OsString::from("-f"),
            OsString::from("image2"),
            output_path.as_os_str().to_owned(),
        ]);
    }
    arguments
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

    // showwavespic gives every column the integer quotient, then assigns the remainder
    // to the last column. Match that boundary rule to reproduce its image exactly.
    for column in 0..width {
        let mut remaining = samples_per_column + u64::from(column == width - 1) * remainder;
        let total_samples = remaining;
        let mut magnitude_sum = 0_u64;
        while remaining > 0 {
            let samples = remaining.min((buffer.len() / 2) as u64) as usize;
            let bytes = &mut buffer[..samples * 2];
            reader.read_exact(bytes)?;
            for sample in bytes.chunks_exact(2) {
                let value = i16::from_le_bytes([sample[0], sample[1]]) as i32;
                magnitude_sum += value.unsigned_abs() as u64;
            }
            remaining -= samples as u64;
        }

        let average = (magnitude_sum / total_samples) as i16;
        writer.write_all(&average.to_le_bytes())?;
    }

    let mut trailing = [0_u8; 1];
    if reader.read(&mut trailing)? != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "decoded audio sample count did not match the analyzed count",
        ));
    }
    writer.flush()
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
    message: &str,
    diagnostics: Option<String>,
) -> WaveformGenerationResult {
    (
        stream_index,
        None,
        Err(AppError::waveform_failed(
            format!("{message} for audio stream #{stream_index}."),
            diagnostics,
        )),
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
    create_temporary_artifact(stream_index, "png")
}

fn create_envelope_artifact(stream_index: u32) -> Result<WaveformArtifact, AppError> {
    create_temporary_artifact(stream_index, "s16le")
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
                    "A temporary waveform directory could not be created.",
                ));
            }
        }
    }

    Err(AppError::io_failed(
        "A unique temporary waveform directory could not be created.",
    ))
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::cancelled("Waveform generation was replaced."),
        io::ErrorKind::NotFound => AppError::waveform_failed(
            "FFmpeg is required to generate audio waveforms.",
            None::<String>,
        ),
        io::ErrorKind::TimedOut => {
            AppError::waveform_failed("Waveform generation took too long.", None::<String>)
        }
        _ => AppError::waveform_failed(
            "FFmpeg could not generate the audio waveform.",
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
        parse_audio_sample_counts, pcm_stream_arguments, render_waveform_arguments,
        validate_waveform_request, write_binned_pcm,
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
    fn builds_counting_streaming_and_render_commands() {
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
            argument == "[0:4]aformat=sample_fmts=s16:channel_layouts=mono[pcm]"
        }));
        assert_eq!(pcm_args.last().unwrap(), "pipe:1");

        let render_args = render_waveform_arguments(
            1_280,
            &[Path::new("C:\\Temp\\audio-2.s16le")],
            &[Path::new("C:\\Temp\\audio-2.png")],
        );
        assert!(render_args.iter().any(|argument| {
            argument == "[0:a:0]showwavespic=s=1280x56:colors=0x8b5cf6:scale=sqrt[waveform0]"
        }));
        assert!(
            render_args
                .windows(2)
                .any(|pair| { pair == [OsString::from("-ar"), OsString::from("1280")] })
        );
    }

    #[test]
    fn applies_signal_effects_before_waveform_analysis_and_sampling() {
        let source_path = Path::new("C:\\Videos\\source clip.mkv");
        let processing = AudioTrackProcessing {
            effects: vec![AudioTrackSignalEffect::NoiseReduction {
                preset: NoiseReductionPreset::Medium,
                stage: crate::media::export::AudioProcessingStage::Cleanup,
            }],
            ..empty_processing()
        };
        let processing_by_stream = [(4, processing.clone())].into_iter().collect();
        let activity_args = activity_arguments(source_path, &[4], &processing_by_stream);
        let pcm_args = pcm_stream_arguments(source_path, 4, &processing);

        assert!(activity_args.iter().any(|argument| {
            argument == "[0:4]afftdn=nr=12:nf=-35,aformat=sample_fmts=s16:channel_layouts=mono,volumedetect@stream4[activity0]"
        }));
        assert!(pcm_args.iter().any(|argument| {
            argument == "[0:4]afftdn=nr=12:nf=-35,aformat=sample_fmts=s16:channel_layouts=mono[pcm]"
        }));
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
    fn sample_binning_matches_showwavespic_column_boundaries() {
        let samples = [1_i16, -2, 3, -4, 5, -6, 7, -8, 9, -10, 11];
        let mut source = Cursor::new(
            samples
                .iter()
                .flat_map(|sample| sample.to_le_bytes())
                .collect::<Vec<_>>(),
        );
        let mut output = Vec::new();

        write_binned_pcm(&mut source, &mut output, samples.len() as u64, 4)
            .expect("samples are reduced into four buckets");

        let buckets = output
            .chunks_exact(2)
            .map(|sample| i16::from_le_bytes([sample[0], sample[1]]))
            .collect::<Vec<_>>();
        assert_eq!(buckets, [1, 3, 5, 9]);
    }

    #[test]
    #[ignore = "requires FFmpeg; generates and verifies a two-minute six-stream fixture"]
    fn bucketed_images_match_full_rate_for_active_and_silent_streams() {
        use crate::process::run_bounded;
        use std::{ffi::OsStr, fs, time::Duration};

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
                    "[0:{stream_index}]aformat=channel_layouts=mono,showwavespic=s=1280x56:colors=0x8b5cf6:scale=sqrt[waveform{position}]"
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
        let generated =
            super::generate_waveforms(&waveform_source, &indexes, 1280, &processing_by_stream)
                .unwrap();
        for (position, ((stream_index, has_signal, result), reference)) in
            generated.iter().zip(&references).enumerate()
        {
            assert_eq!(*stream_index, position as u32);
            assert_eq!(*has_signal, Some(position % 2 == 0));
            let artifact = result.as_ref().expect("waveform generation succeeds");
            let image = fs::read(artifact.path()).unwrap();
            let reference_image = fs::read(reference.path()).unwrap();
            assert_eq!(image, reference_image);
            assert_eq!(&image[..8], b"\x89PNG\r\n\x1a\n");
            assert_eq!(u32::from_be_bytes(image[16..20].try_into().unwrap()), 1280);
            assert_eq!(u32::from_be_bytes(image[20..24].try_into().unwrap()), 56);
        }
    }
}
