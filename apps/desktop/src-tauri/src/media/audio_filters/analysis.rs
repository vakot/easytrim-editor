use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use serde::Deserialize;

use crate::{
    error::{AppError, AppErrorMessageId},
    media::export::{TrimSelection, validate_audio_stream, validate_trim_selection},
    process::{ProcessOutput, run_bounded_cancellable},
    state::ActiveSource,
};

use super::{
    compiler::{CompiledChain, compile_chain},
    model::{AudioChainSelection, AudioLoudnessAnalysis, FilterMeasurement, validate_filter_chain},
};

// loudnorm reports input measurements independently of its own targets.
const MEASUREMENT_FILTER: &str = "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json";
const ANALYSIS_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const ANALYSIS_STDERR_LIMIT: usize = 128 * 1024;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessAnalysisRequest {
    pub trim: TrimSelection,
    pub audio_track: AudioChainSelection,
}

/// Measures every loudness normalization instance in chain order.
///
/// Each instance is measured on the exact signal that reaches it: the source range processed by
/// all preceding filters, including earlier normalization instances resolved with their own
/// measurements. That dependency makes the passes sequential; no PCM is written.
pub fn analyze_chain_loudness(
    source: &ActiveSource,
    request: &LoudnessAnalysisRequest,
    operation_cancellation: &AtomicBool,
) -> Result<Vec<FilterMeasurement>, AppError> {
    let media = source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request(
            AppErrorMessageId::MediaLoudnessInspectTheVideoBeforeAnalyzingAudio,
        )
    })?;
    validate_trim_selection(media, &request.trim)?;
    validate_audio_stream(media, request.audio_track.stream_index)?;
    let filters = &request.audio_track.filters;
    validate_filter_chain(filters)?;

    let mut measurements: Vec<FilterMeasurement> = Vec::new();
    for (index, filter) in filters.iter().enumerate() {
        if !filter.kind.requires_global_analysis() {
            continue;
        }
        let upstream = compile_chain(&filters[..index], &measurements)?;
        let analysis = measure(
            source,
            &request.trim,
            request.audio_track.stream_index,
            &upstream,
            operation_cancellation,
        )?;
        measurements.push(FilterMeasurement {
            filter_id: filter.id.clone(),
            analysis,
        });
    }
    Ok(measurements)
}

fn measure(
    source: &ActiveSource,
    trim: &TrimSelection,
    stream_index: u32,
    upstream: &CompiledChain,
    operation_cancellation: &AtomicBool,
) -> Result<AudioLoudnessAnalysis, AppError> {
    let arguments = analysis_arguments(&source.path, trim, stream_index, upstream);
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
            AppErrorMessageId::MediaLoudnessFfmpegCouldNotAnalyzeAudioLoudness,
            diagnostics(&output, &source.path),
        ));
    }
    if output.stderr_truncated {
        return Err(AppError::render_failed(
            AppErrorMessageId::MediaLoudnessLoudnessAnalysisOutputExceededItsSafetyLimit,
        ));
    }

    parse_loudness(&output.stderr)
}

fn analysis_arguments(
    source_path: &Path,
    trim: &TrimSelection,
    stream_index: u32,
    upstream: &CompiledChain,
) -> Vec<OsString> {
    let duration_seconds = (trim.end_micros - trim.start_micros) as f64 / 1_000_000.0;
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-v"),
        OsString::from("info"),
        OsString::from("-ss"),
        OsString::from(format_seconds(trim.start_micros)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-t"),
        OsString::from(format!("{duration_seconds:.6}")),
        OsString::from("-filter_complex"),
        OsString::from(format!(
            "[0:{stream_index}]{},{MEASUREMENT_FILTER}[measured]",
            upstream.canonical_graph()
        )),
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

fn parse_loudness(stderr: &[u8]) -> Result<AudioLoudnessAnalysis, AppError> {
    let text = String::from_utf8_lossy(stderr);
    let Some(start) = text.rfind('{') else {
        return Err(AppError::render_failed_with_diagnostics(
            AppErrorMessageId::MediaLoudnessFfmpegDidNotReturnLoudnessMeasurements,
            Some(text.trim().to_owned()),
        ));
    };
    let end = text[start..]
        .find('}')
        .map(|offset| start + offset + 1)
        .ok_or_else(|| {
            AppError::render_failed(
                AppErrorMessageId::MediaLoudnessFfmpegReturnedIncompleteLoudnessMeasurements,
            )
        })?;
    let measurements: LoudnormMeasurements =
        serde_json::from_str(&text[start..end]).map_err(|_| {
            AppError::render_failed(
                AppErrorMessageId::MediaLoudnessFfmpegReturnedInvalidLoudnessMeasurements,
            )
        })?;
    Ok(AudioLoudnessAnalysis {
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
        io::ErrorKind::Interrupted => {
            AppError::cancelled(AppErrorMessageId::MediaLoudnessLoudnessAnalysisWasInterrupted)
        }
        io::ErrorKind::NotFound => AppError::render_failed(
            AppErrorMessageId::MediaLoudnessFfmpegIsRequiredToAnalyzeLoudness,
        ),
        io::ErrorKind::TimedOut => {
            AppError::render_failed(AppErrorMessageId::MediaLoudnessLoudnessAnalysisTookTooLong)
        }
        _ => AppError::render_failed(
            AppErrorMessageId::MediaLoudnessFfmpegCouldNotAnalyzeAudioLoudness,
        ),
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
    use std::{ffi::OsString, path::Path, sync::atomic::AtomicBool};

    use super::{
        LoudnessAnalysisRequest, analysis_arguments, analyze_chain_loudness, parse_loudness,
    };
    use crate::media::{
        audio_filters::{
            compiler::compile_chain,
            model::{AudioChainSelection, AudioFilter, FilterMeasurement, fixtures::*},
            test_fixtures::{PROGRAM_MATERIAL, fixture_source, generate_fixture},
        },
        export::TrimSelection,
    };

    #[test]
    fn parses_integrated_loudness_and_true_peak_from_ffmpeg_json() {
        let result = parse_loudness(
            b"[Parsed_loudnorm]\n{\n\"input_i\" : \"-17.2\",\n\"input_tp\" : \"-1.4\",\n\"input_lra\" : \"4.2\",\n\"input_thresh\" : \"-27.1\"\n}\n",
        )
        .unwrap();
        assert_eq!(result.integrated_lufs, Some(-17.2));
        assert_eq!(result.true_peak_db, Some(-1.4));
        assert_eq!(result.input_lra, Some(4.2));
        assert_eq!(result.input_threshold, Some(-27.1));
    }

    #[test]
    fn reports_unavailable_measurements_as_none() {
        let result = parse_loudness(
            b"[Parsed_loudnorm]\n{\n\"input_i\" : \"-inf\",\n\"input_tp\" : \"-inf\",\n\"input_lra\" : \"-inf\",\n\"input_thresh\" : \"-inf\"\n}\n",
        )
        .unwrap();
        assert_eq!(result.integrated_lufs, None);
        assert_eq!(result.true_peak_db, None);
    }

    #[test]
    fn measures_the_exact_signal_reaching_the_instance() {
        let upstream = compile_chain(&[high_pass("hp", 100.0), gain("g", -6.0)], &[]).unwrap();
        let arguments = analysis_arguments(
            Path::new("input.mp4"),
            &TrimSelection {
                start_micros: 1_000_000,
                end_micros: 3_500_000,
            },
            3,
            &upstream,
        );
        let graph = arguments
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .map(|pair| pair[1].to_string_lossy().into_owned())
            .unwrap();
        assert_eq!(
            graph,
            "[0:3]aresample=48000:async=1:first_pts=0,highpass=f=100,volume=-6dB:precision=double,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[measured]"
        );
        assert!(
            arguments
                .windows(2)
                .any(|pair| pair == [OsString::from("-ss"), OsString::from("1.000000")])
        );
        assert!(
            arguments
                .windows(2)
                .any(|pair| pair == [OsString::from("-t"), OsString::from("2.500000")])
        );
    }

    fn analyze(path: &Path, filters: Vec<AudioFilter>) -> Vec<FilterMeasurement> {
        analyze_chain_loudness(
            &fixture_source(path, 8_000_000),
            &LoudnessAnalysisRequest {
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 8_000_000,
                },
                audio_track: AudioChainSelection {
                    stream_index: 0,
                    filters,
                    loudness_measurements: Vec::new(),
                },
            },
            &AtomicBool::new(false),
        )
        .expect("FFmpeg measures the fixture")
    }

    #[test]
    fn multiple_normalization_instances_are_measured_after_their_dependencies() {
        let fixture = generate_fixture("analysis", PROGRAM_MATERIAL, "wav", "pcm_s16le");
        let measurements = analyze(
            fixture.path(),
            vec![
                normalization("first", -30.0),
                gain("boost", 6.0),
                normalization("second", -16.0),
            ],
        );
        assert_eq!(
            measurements
                .iter()
                .map(|measurement| measurement.filter_id.as_str())
                .collect::<Vec<_>>(),
            ["first", "second"]
        );
        let first = measurements[0].analysis.integrated_lufs.unwrap();
        let second = measurements[1].analysis.integrated_lufs.unwrap();
        // The second instance hears the first normalization's -30 LUFS output plus 6 dB of gain.
        assert!((first - -21.4).abs() < 0.5, "source loudness was {first}");
        assert!(
            (second - -24.0).abs() < 0.5,
            "second instance input was {second}"
        );
    }

    #[test]
    fn downstream_filters_do_not_change_an_instance_measurement() {
        let fixture = generate_fixture("analysis-downstream", PROGRAM_MATERIAL, "wav", "pcm_s16le");
        let base = analyze(fixture.path(), vec![normalization("norm", -16.0)]);
        let with_downstream = analyze(
            fixture.path(),
            vec![
                normalization("norm", -23.0),
                limiter("lim", -6.0),
                gain("g", 12.0),
            ],
        );
        assert_eq!(base, with_downstream);
    }

    #[test]
    fn upstream_filters_change_an_instance_measurement() {
        let fixture = generate_fixture("analysis-upstream", PROGRAM_MATERIAL, "wav", "pcm_s16le");
        let base = analyze(fixture.path(), vec![normalization("norm", -16.0)]);
        let attenuated = analyze(
            fixture.path(),
            vec![gain("g", -10.0), normalization("norm", -16.0)],
        );
        let difference = base[0].analysis.integrated_lufs.unwrap()
            - attenuated[0].analysis.integrated_lufs.unwrap();
        assert!(
            (difference - 10.0).abs() < 0.05,
            "upstream gain changed loudness by {difference}"
        );
    }
}
