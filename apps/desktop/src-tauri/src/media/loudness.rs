use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::atomic::Ordering,
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

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessAnalysisRequest {
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    pub merge_audio: bool,
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
) -> Result<LoudnessAnalysis, AppError> {
    let media = source
        .media
        .as_ref()
        .ok_or_else(|| AppError::invalid_request("Inspect the video before analyzing audio."))?;
    validate_common_request(media, &request.trim, &request.audio_tracks)?;
    if request.audio_tracks.is_empty() {
        return Err(AppError::invalid_request(
            "Select at least one audio track before analyzing loudness.",
        ));
    }

    let arguments = analysis_arguments(request, &source.path);
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        ANALYSIS_TIMEOUT,
        16 * 1024,
        ANALYSIS_STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
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
        OsString::from(analysis_filter_graph(
            &request.audio_tracks,
            request.merge_audio,
        )),
        OsString::from("-map"),
        OsString::from("[aout]"),
        OsString::from("-af"),
        OsString::from(format!(
            "loudnorm=I={ANALYSIS_TARGET_LUFS}:TP={ANALYSIS_TRUE_PEAK_DB}:LRA=11:print_format=json"
        )),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("null"),
        OsString::from("-"),
    ]
}

fn analysis_filter_graph(audio_tracks: &[AudioTrackSelection], merge_audio: bool) -> String {
    let mut graph = audio_filter_graph(audio_tracks, false);
    let inputs = (0..audio_tracks.len())
        .map(|index| format!("[audio{index}]"))
        .collect::<String>();
    if merge_audio {
        graph.push(';');
        graph.push_str(&format!(
            "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=1[aout]",
            audio_tracks.len()
        ));
    } else if audio_tracks.len() == 1 {
        graph.push_str(";[audio0]anull[aout]");
    } else {
        graph.push(';');
        graph.push_str(&format!(
            "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
            audio_tracks.len()
        ));
    }
    graph
}

fn parse_loudness(stderr: &[u8]) -> Result<LoudnessAnalysis, AppError> {
    let text = String::from_utf8_lossy(stderr);
    let Some(start) = text.rfind("{\n") else {
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
    use super::{LoudnessAnalysis, analysis_filter_graph, parse_loudness};
    use crate::media::export::AudioTrackSelection;

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
    fn analysis_graph_preserves_track_gains_and_merge_policy() {
        let tracks = vec![
            AudioTrackSelection {
                stream_index: 1,
                volume_percent: 25,
            },
            AudioTrackSelection {
                stream_index: 3,
                volume_percent: 100,
            },
        ];
        let graph = analysis_filter_graph(&tracks, true);
        assert!(graph.contains("[0:1]volume=0.500000[audio0]"));
        assert!(graph.contains("[0:3]volume=2.000000[audio1]"));
        assert!(graph.ends_with(
            "[audio0][audio1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[aout]"
        ));
        assert!(analysis_filter_graph(&tracks, false).ends_with("normalize=0[aout]"));
    }
}
