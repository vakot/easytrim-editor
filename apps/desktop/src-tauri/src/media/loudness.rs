use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use serde::Deserialize;

use crate::{
    error::AppError,
    media::export::{
        AudioLoudnessAnalysis, AudioTrackSelection, TrimSelection, pre_level_filter_chain,
        validate_loudness_analysis_request,
    },
    process::{ProcessOutput, run_bounded_cancellable},
    state::ActiveSource,
};

const ANALYSIS_TARGET_LUFS: f64 = -16.0;
const ANALYSIS_TRUE_PEAK_DB: f64 = -1.5;
const ANALYSIS_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const ANALYSIS_STDERR_LIMIT: usize = 128 * 1024;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessAnalysisRequest {
    pub trim: TrimSelection,
    pub audio_track: AudioTrackSelection,
}

pub type LoudnessAnalysis = AudioLoudnessAnalysis;

pub fn analyze_loudness(
    source: &ActiveSource,
    request: &LoudnessAnalysisRequest,
    operation_cancellation: &AtomicBool,
) -> Result<LoudnessAnalysis, AppError> {
    let media = source
        .media
        .as_ref()
        .ok_or_else(|| AppError::invalid_request("Inspect the video before analyzing audio."))?;
    validate_loudness_analysis_request(media, &request.trim, &request.audio_track)?;

    let arguments = analysis_arguments(request, &source.path);
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        ANALYSIS_TIMEOUT,
        16 * 1024,
        ANALYSIS_STDERR_LIMIT,
        || {
            source.cancellation.load(Ordering::Acquire)
                || operation_cancellation.load(Ordering::Acquire)
        },
    )
    .map_err(process_error)?;

    if !output.status.success() {
        return Err(AppError::render_failed_with_diagnostics(
            "FFmpeg could not analyze audio loudness.",
            diagnostics(&output, &source.path),
        ));
    }
    if output.stderr_truncated {
        return Err(AppError::render_failed(
            "The loudness analysis output exceeded its safety limit.",
        ));
    }

    parse_loudness(&output.stderr)
}

fn analysis_arguments(request: &LoudnessAnalysisRequest, source_path: &Path) -> Vec<OsString> {
    let duration_seconds =
        (request.trim.end_micros - request.trim.start_micros) as f64 / 1_000_000.0;
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-v"),
        OsString::from("info"),
        OsString::from("-ss"),
        OsString::from(format_seconds(request.trim.start_micros)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-t"),
        OsString::from(format!("{duration_seconds:.6}")),
        OsString::from("-filter_complex"),
        OsString::from(analysis_filter_graph(&request.audio_track)),
        OsString::from("-map"),
        OsString::from("[measured]"),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("null"),
        OsString::from("-"),
    ]
}

fn analysis_filter_graph(audio_track: &AudioTrackSelection) -> String {
    let pre_level_filters = pre_level_filter_chain(&audio_track.processing);
    let pre_level_prefix = if pre_level_filters.is_empty() {
        String::new()
    } else {
        format!("{pre_level_filters},")
    };
    format!(
        "[0:{}]{pre_level_prefix}loudnorm=I={ANALYSIS_TARGET_LUFS}:TP={ANALYSIS_TRUE_PEAK_DB}:LRA=11:print_format=json[measured]",
        audio_track.stream_index,
    )
}

fn parse_loudness(stderr: &[u8]) -> Result<LoudnessAnalysis, AppError> {
    let text = String::from_utf8_lossy(stderr);
    let Some(start) = text.rfind('{') else {
        return Err(AppError::render_failed_with_diagnostics(
            "FFmpeg did not return loudness measurements.",
            Some(text.trim().to_owned()),
        ));
    };
    let end = text[start..]
        .find('}')
        .map(|offset| start + offset + 1)
        .ok_or_else(|| {
            AppError::render_failed("FFmpeg returned incomplete loudness measurements.")
        })?;
    let measurements: LoudnormMeasurements = serde_json::from_str(&text[start..end])
        .map_err(|_| AppError::render_failed("FFmpeg returned invalid loudness measurements."))?;
    Ok(LoudnessAnalysis {
        input_lra: measurements
            .input_lra
            .as_deref()
            .and_then(parse_measurement),
        input_threshold: measurements
            .input_thresh
            .as_deref()
            .and_then(parse_measurement),
        integrated_lufs: parse_measurement(&measurements.input_i),
        true_peak_db: parse_measurement(&measurements.input_tp),
    })
}

#[derive(Deserialize)]
struct LoudnormMeasurements {
    input_i: String,
    input_tp: String,
    input_lra: Option<String>,
    input_thresh: Option<String>,
}

fn parse_measurement(value: &str) -> Option<f64> {
    value.parse::<f64>().ok().filter(|value| value.is_finite())
}

fn format_seconds(micros: i64) -> String {
    format!("{:.6}", micros as f64 / 1_000_000.0)
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::cancelled("Loudness analysis was interrupted."),
        io::ErrorKind::NotFound => {
            AppError::render_failed("FFmpeg is required to analyze loudness.")
        }
        io::ErrorKind::TimedOut => AppError::render_failed("Loudness analysis took too long."),
        _ => AppError::render_failed("FFmpeg could not analyze audio loudness."),
    }
}

fn diagnostics(output: &ProcessOutput, source_path: &Path) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr);
    let value = value.replace(source_path.to_string_lossy().as_ref(), "<source>");
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use std::{
        ffi::{OsStr, OsString},
        path::Path,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    use super::{
        LoudnessAnalysis, LoudnessAnalysisRequest, analysis_arguments, analysis_filter_graph,
        parse_loudness,
    };
    use crate::{
        media::export::{
            AudioProcessingStage, AudioTrackProcessing, AudioTrackSelection,
            AudioTrackSignalEffect, CustomLoudnessMode, CustomLoudnessNormalization,
            LoudnessNormalization, LoudnessPreset, TrimSelection, audio_filter_graph,
        },
        process::run_bounded,
    };

    #[test]
    fn parses_integrated_loudness_and_true_peak_from_ffmpeg_json() {
        let result = parse_loudness(
            b"[Parsed_loudnorm]\n{\n\"input_i\" : \"-17.2\",\n\"input_tp\" : \"-1.4\",\n\"input_lra\" : \"4.2\",\n\"input_thresh\" : \"-27.1\"\n}\n",
        )
        .unwrap();
        assert_eq!(
            result,
            LoudnessAnalysis {
                input_lra: Some(4.2),
                input_threshold: Some(-27.1),
                integrated_lufs: Some(-17.2),
                true_peak_db: Some(-1.4),
            }
        );
    }

    #[test]
    fn reports_unavailable_measurements_as_none() {
        let result = parse_loudness(
            b"[Parsed_loudnorm]\n{\n\"input_i\" : \"-inf\",\n\"input_tp\" : \"-inf\",\n\"input_lra\" : \"-inf\",\n\"input_thresh\" : \"-inf\"\n}\n",
        )
        .unwrap();
        assert_eq!(result.integrated_lufs, None);
        assert_eq!(result.true_peak_db, None);
        assert_eq!(result.input_lra, None);
        assert_eq!(result.input_threshold, None);
    }

    #[test]
    fn analysis_graph_measures_source_independently_of_level_processing() {
        let track = AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 3,
            processing: AudioTrackProcessing {
                gain_db: -6.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Broadcast,
                )),
                effects: vec![
                    AudioTrackSignalEffect::HighPass {
                        cutoff_hz: 100.0,
                        stage: AudioProcessingStage::Cleanup,
                    },
                    AudioTrackSignalEffect::HighPass {
                        cutoff_hz: 300.0,
                        stage: AudioProcessingStage::FinalProtection,
                    },
                ],
            },
        };
        let graph = analysis_filter_graph(&track);
        assert_eq!(
            graph,
            "[0:3]highpass=f=100.000,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[measured]"
        );
    }

    #[test]
    fn bundled_ffmpeg_loudness_analysis_and_measured_normalization_round_trip() {
        for (layout, source_filter, expected_channels) in [
            ("mono", "sine=frequency=440:sample_rate=48000:duration=4", 1),
            (
                "surround",
                "aevalsrc=0.1*sin(2*PI*440*t)|0.1*sin(2*PI*440*t)|0.1*sin(2*PI*440*t)|0.1*sin(2*PI*440*t)|0.1*sin(2*PI*440*t)|0.1*sin(2*PI*440*t):s=48000:d=4:c=5.1",
                6,
            ),
        ] {
            loudness_normalization_round_trip(layout, source_filter, expected_channels);
        }
    }

    fn loudness_normalization_round_trip(
        layout: &str,
        source_filter: &str,
        expected_channels: u32,
    ) {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time is valid")
            .as_nanos();
        let source_path = std::env::temp_dir().join(format!(
            "easytrim-loudness-{layout}-{}-{unique_id}.wav",
            std::process::id()
        ));
        let output_path = std::env::temp_dir().join(format!(
            "easytrim-loudness-normalized-{layout}-{}-{unique_id}.wav",
            std::process::id()
        ));
        let generate_fixture = run_bounded(
            OsStr::new("ffmpeg"),
            &[
                OsString::from("-hide_banner"),
                OsString::from("-nostdin"),
                OsString::from("-f"),
                OsString::from("lavfi"),
                OsString::from("-i"),
                OsString::from(source_filter),
                OsString::from("-ar"),
                OsString::from("48000"),
                OsString::from("-y"),
                source_path.as_os_str().to_owned(),
            ],
            Duration::from_secs(30),
            16 * 1024,
            16 * 1024,
        )
        .expect("FFmpeg creates the audio fixture");
        assert!(
            generate_fixture.status.success(),
            "{}",
            String::from_utf8_lossy(&generate_fixture.stderr)
        );

        let processing = AudioTrackProcessing {
            gain_db: 0.0,
            loudness_normalization: None,
            effects: vec![AudioTrackSignalEffect::HighPass {
                cutoff_hz: 80.0,
                stage: AudioProcessingStage::Cleanup,
            }],
        };

        let request = LoudnessAnalysisRequest {
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 4_000_000,
            },
            audio_track: AudioTrackSelection {
                loudness_analysis: None,
                stream_index: 0,
                processing: processing.clone(),
            },
        };
        assert!(analysis_filter_graph(&request.audio_track).starts_with(
            "[0:0]highpass=f=80.000,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[measured]"
        ));
        let analysis_output = run_bounded(
            OsStr::new("ffmpeg"),
            &analysis_arguments(&request, Path::new(&source_path)),
            Duration::from_secs(30),
            16 * 1024,
            128 * 1024,
        )
        .expect("FFmpeg runs the loudness analysis");
        assert!(
            analysis_output.status.success(),
            "{}",
            String::from_utf8_lossy(&analysis_output.stderr)
        );
        let input_measurement =
            parse_loudness(&analysis_output.stderr).expect("FFmpeg returns loudness JSON");
        assert!(input_measurement.input_lra.is_some());
        assert!(input_measurement.input_threshold.is_some());

        let normalization_track = AudioTrackSelection {
            loudness_analysis: Some(input_measurement),
            stream_index: 0,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: Some(LoudnessNormalization::Custom(
                    CustomLoudnessNormalization {
                        mode: CustomLoudnessMode::Custom,
                        target_lufs: -12.0,
                        max_true_peak_db: -9.0,
                    },
                )),
                effects: processing.effects.clone(),
            },
        };
        let normalize_graph = audio_filter_graph(&[normalization_track], false);
        assert!(
            normalize_graph.starts_with(
                "[0:0]highpass=f=80.000,loudnorm=I=-12.000:TP=-9.000:LRA=11:measured_I="
            )
        );
        let normalized = run_bounded(
            OsStr::new("ffmpeg"),
            &[
                OsString::from("-hide_banner"),
                OsString::from("-nostdin"),
                OsString::from("-v"),
                OsString::from("error"),
                OsString::from("-i"),
                source_path.as_os_str().to_owned(),
                OsString::from("-filter_complex"),
                OsString::from(normalize_graph),
                OsString::from("-map"),
                OsString::from("[audio0]"),
                OsString::from("-c:a"),
                OsString::from("pcm_s24le"),
                OsString::from("-y"),
                output_path.as_os_str().to_owned(),
            ],
            Duration::from_secs(30),
            16 * 1024,
            128 * 1024,
        )
        .expect("FFmpeg runs the measured normalization pass");
        assert!(
            normalized.status.success(),
            "{}",
            String::from_utf8_lossy(&normalized.stderr)
        );

        let output_measurement = analyze_loudness_file(&output_path, 4_000_000);
        let channels = run_bounded(
            OsStr::new("ffprobe"),
            &[
                OsString::from("-v"),
                OsString::from("error"),
                OsString::from("-select_streams"),
                OsString::from("a:0"),
                OsString::from("-show_entries"),
                OsString::from("stream=channels"),
                OsString::from("-of"),
                OsString::from("csv=p=0"),
                output_path.as_os_str().to_owned(),
            ],
            Duration::from_secs(30),
            16 * 1024,
            16 * 1024,
        )
        .expect("FFprobe checks the normalized channel count");
        assert!(channels.status.success());
        assert_eq!(
            String::from_utf8_lossy(&channels.stdout).trim(),
            expected_channels.to_string()
        );
        let sample_rate = run_bounded(
            OsStr::new("ffprobe"),
            &[
                OsString::from("-v"),
                OsString::from("error"),
                OsString::from("-select_streams"),
                OsString::from("a:0"),
                OsString::from("-show_entries"),
                OsString::from("stream=sample_rate"),
                OsString::from("-of"),
                OsString::from("csv=p=0"),
                output_path.as_os_str().to_owned(),
            ],
            Duration::from_secs(30),
            16 * 1024,
            16 * 1024,
        )
        .expect("FFprobe checks the normalized sample rate");
        assert!(sample_rate.status.success());
        assert_eq!(String::from_utf8_lossy(&sample_rate.stdout).trim(), "48000");
        assert!(
            output_measurement
                .integrated_lufs
                .is_some_and(|value| (value - -12.0).abs() <= 2.0),
            "{layout} integrated loudness was {:?}",
            output_measurement.integrated_lufs
        );
        assert!(
            output_measurement
                .true_peak_db
                .is_some_and(|value| value <= -8.0),
            "{layout} true peak exceeded the requested -9 dBTP cap: {:?}",
            output_measurement.true_peak_db
        );

        let _ = std::fs::remove_file(&source_path);
        let _ = std::fs::remove_file(&output_path);
    }

    fn analyze_loudness_file(source_path: &Path, duration_micros: i64) -> LoudnessAnalysis {
        let request = LoudnessAnalysisRequest {
            trim: TrimSelection {
                start_micros: 0,
                end_micros: duration_micros,
            },
            audio_track: AudioTrackSelection {
                loudness_analysis: None,
                stream_index: 0,
                processing: AudioTrackProcessing {
                    gain_db: 0.0,
                    loudness_normalization: None,
                    effects: Vec::new(),
                },
            },
        };
        let output = run_bounded(
            OsStr::new("ffmpeg"),
            &analysis_arguments(&request, source_path),
            Duration::from_secs(30),
            16 * 1024,
            128 * 1024,
        )
        .expect("FFmpeg re-analyzes the normalized audio");
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        parse_loudness(&output.stderr).expect("FFmpeg returns output loudness JSON")
    }
}
