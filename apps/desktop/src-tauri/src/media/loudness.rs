use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use serde::{Deserialize, Serialize};

use crate::{
    error::AppError,
    media::export::{
        AudioTrackSelection, TrimSelection, audio_filter_graph, validate_common_request,
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

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessAnalysis {
    pub integrated_lufs: Option<f64>,
    pub true_peak_db: Option<f64>,
}

pub fn analyze_loudness(
    source: &ActiveSource,
    request: &LoudnessAnalysisRequest,
    operation_cancellation: &AtomicBool,
) -> Result<LoudnessAnalysis, AppError> {
    let media = source
        .media
        .as_ref()
        .ok_or_else(|| AppError::invalid_request("Inspect the video before analyzing audio."))?;
    validate_common_request(
        media,
        &request.trim,
        std::slice::from_ref(&request.audio_track),
    )?;

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
        OsString::from("-ac"),
        OsString::from("2"),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("null"),
        OsString::from("-"),
    ]
}

fn analysis_filter_graph(audio_track: &AudioTrackSelection) -> String {
    let mut graph = audio_filter_graph(std::slice::from_ref(audio_track), false);
    graph.push_str(&format!(
        ";[audio0]aformat=channel_layouts=stereo,loudnorm=I={ANALYSIS_TARGET_LUFS}:TP={ANALYSIS_TRUE_PEAK_DB}:LRA=11:print_format=json[measured]"
    ));
    graph
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
        integrated_lufs: parse_measurement(&measurements.input_i),
        true_peak_db: parse_measurement(&measurements.input_tp),
    })
}

#[derive(Deserialize)]
struct LoudnormMeasurements {
    input_i: String,
    input_tp: String,
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
        media::export::{AudioTrackProcessing, AudioTrackSelection, LoudnessPreset, TrimSelection},
        process::run_bounded,
    };

    #[test]
    fn parses_integrated_loudness_and_true_peak_from_ffmpeg_json() {
        let result = parse_loudness(
            b"[Parsed_loudnorm]\n{\n\"input_i\" : \"-17.2\",\n\"input_tp\" : \"-1.4\"\n}\n",
        )
        .unwrap();
        assert_eq!(
            result,
            LoudnessAnalysis {
                integrated_lufs: Some(-17.2),
                true_peak_db: Some(-1.4),
            }
        );
    }

    #[test]
    fn reports_unavailable_measurements_as_none() {
        let result = parse_loudness(
            b"[Parsed_loudnorm]\n{\n\"input_i\" : \"-inf\",\n\"input_tp\" : \"-inf\"\n}\n",
        )
        .unwrap();
        assert_eq!(result.integrated_lufs, None);
        assert_eq!(result.true_peak_db, None);
    }

    #[test]
    fn analysis_graph_uses_track_processing_before_measurement() {
        let track = AudioTrackSelection {
            stream_index: 3,
            processing: AudioTrackProcessing {
                gain_db: -6.0,
                loudness_normalization: Some(LoudnessPreset::Broadcast),
            },
        };
        let graph = analysis_filter_graph(&track);
        assert!(graph.contains("[0:3]volume=-6.000000dB[track0_gain]"));
        assert!(graph.contains("[track0_gain]loudnorm=I=-23:TP=-2:LRA=11[audio0]"));
        assert!(graph.contains("[audio0]aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[measured]"));
    }

    #[test]
    fn bundled_ffmpeg_shape_reports_measurements_for_a_selected_audio_segment() {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time is valid")
            .as_nanos();
        let source_path = std::env::temp_dir().join(format!(
            "easytrim-loudness-{}-{unique_id}.wav",
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
                OsString::from("sine=frequency=440:duration=2"),
                OsString::from("-y"),
                source_path.as_os_str().to_owned(),
            ],
            Duration::from_secs(30),
            16 * 1024,
            16 * 1024,
        )
        .expect("FFmpeg creates the audio fixture");
        assert!(generate_fixture.status.success());

        let request = LoudnessAnalysisRequest {
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 2_000_000,
            },
            audio_track: AudioTrackSelection {
                stream_index: 0,
                processing: AudioTrackProcessing {
                    gain_db: 0.0,
                    loudness_normalization: None,
                },
            },
        };
        let output = run_bounded(
            OsStr::new("ffmpeg"),
            &analysis_arguments(&request, Path::new(&source_path)),
            Duration::from_secs(30),
            16 * 1024,
            128 * 1024,
        )
        .expect("FFmpeg runs the loudness analysis");
        let _ = std::fs::remove_file(&source_path);
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let result = parse_loudness(&output.stderr).expect("FFmpeg returns loudness JSON");
        assert!(result.integrated_lufs.is_some());
        assert!(result.true_peak_db.is_some());
    }
}
