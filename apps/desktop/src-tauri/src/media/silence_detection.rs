use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::atomic::Ordering,
    time::Duration,
};

use serde::Serialize;

use crate::{
    error::AppError,
    process::{ProcessOutput, run_bounded_cancellable},
    state::ActiveSource,
};

const SILENCE_THRESHOLD_DB: i32 = -50;
const MIN_SILENCE_SECONDS: f64 = 0.25;
const SILENCE_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const SILENCE_STDOUT_LIMIT: usize = 16 * 1024;
const SILENCE_STDERR_LIMIT: usize = 4 * 1024 * 1024;
const MAX_SILENCE_RANGES: usize = 20_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SilenceRange {
    pub start_micros: u64,
    pub end_micros: u64,
}

pub fn detect_silence_ranges(
    source: &ActiveSource,
    mix: &[(u32, u16)],
    merge_audio: bool,
    duration_micros: u64,
) -> Result<Vec<SilenceRange>, AppError> {
    if mix.is_empty() {
        return Err(AppError::invalid_request(
            "Enable at least one audio track before detecting audio activity.",
        ));
    }

    let arguments = silence_detection_arguments(&source.path, mix, merge_audio);
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        SILENCE_TIMEOUT,
        SILENCE_STDOUT_LIMIT,
        SILENCE_STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
    )
    .map_err(process_error)?;

    if !output.status.success() {
        return Err(AppError::silence_detection_failed(
            "FFmpeg could not analyze audio activity.",
            diagnostics(&output, &source.path),
        ));
    }
    if output.stderr_truncated {
        return Err(AppError::silence_detection_failed(
            "The audio activity analysis output exceeded its safety limit.",
            None::<String>,
        ));
    }

    parse_silence_ranges(&output.stderr, duration_micros)
}

fn silence_detection_arguments(
    source_path: &Path,
    mix: &[(u32, u16)],
    merge_audio: bool,
) -> Vec<OsString> {
    let mut filters = Vec::with_capacity(mix.len() + 1);
    for (position, (stream_index, volume_percent)) in mix.iter().enumerate() {
        let gain = f64::from(*volume_percent) / 50.0;
        filters.push(format!(
            "[0:{stream_index}]aformat=channel_layouts=mono,volume={gain:.3}[audio{position}]"
        ));
    }
    let inputs = (0..mix.len())
        .map(|position| format!("[audio{position}]"))
        .collect::<String>();
    filters.push(format!(
        "{inputs}amix=inputs={}:normalize={}:duration=longest,silencedetect=noise={SILENCE_THRESHOLD_DB}dB:d={MIN_SILENCE_SECONDS}[silenceout]",
        mix.len(),
        u8::from(merge_audio)
    ));

    let filter_complex = filters.join(";");
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostats"),
        OsString::from("-v"),
        OsString::from("info"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-filter_complex"),
        OsString::from(filter_complex),
        OsString::from("-map"),
        OsString::from("[silenceout]"),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("null"),
        OsString::from("-"),
    ]
}

fn parse_silence_ranges(
    stderr: &[u8],
    duration_micros: u64,
) -> Result<Vec<SilenceRange>, AppError> {
    let mut ranges = Vec::new();
    let mut current_start = None;
    for line in String::from_utf8_lossy(stderr).lines() {
        if let Some(value) = line.split_once("silence_start:").map(|(_, value)| value) {
            current_start = parse_timestamp(value);
        } else if let Some(value) = line.split_once("silence_end:").map(|(_, value)| value) {
            let Some(start_micros) = current_start.take() else {
                continue;
            };
            let Some(end_micros) = parse_timestamp(value) else {
                continue;
            };
            if end_micros > start_micros {
                ranges.push(SilenceRange {
                    start_micros,
                    end_micros,
                });
                if ranges.len() > MAX_SILENCE_RANGES {
                    return Err(AppError::silence_detection_failed(
                        "The audio activity analysis contains too many ranges.",
                        None::<String>,
                    ));
                }
            }
        }
    }
    if let Some(start_micros) = current_start
        && duration_micros > start_micros
    {
        ranges.push(SilenceRange {
            start_micros,
            end_micros: duration_micros,
        });
        if ranges.len() > MAX_SILENCE_RANGES {
            return Err(AppError::silence_detection_failed(
                "The audio activity analysis contains too many ranges.",
                None::<String>,
            ));
        }
    }
    Ok(ranges)
}

fn parse_timestamp(value: &str) -> Option<u64> {
    let seconds = value.split_whitespace().next()?.parse::<f64>().ok()?;
    if !seconds.is_finite() || seconds < 0.0 {
        return None;
    }
    let micros = (seconds * 1_000_000.0).round();
    (micros.is_finite() && micros <= u64::MAX as f64).then_some(micros as u64)
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => {
            AppError::cancelled("Audio activity detection was interrupted.")
        }
        io::ErrorKind::NotFound => AppError::silence_detection_failed(
            "FFmpeg is required to analyze audio activity.",
            None::<String>,
        ),
        io::ErrorKind::TimedOut => AppError::silence_detection_failed(
            "Audio activity detection took too long.",
            None::<String>,
        ),
        _ => AppError::silence_detection_failed(
            "FFmpeg could not analyze audio activity.",
            None::<String>,
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
    use super::{SilenceRange, parse_silence_ranges, silence_detection_arguments};
    use std::path::Path;

    #[test]
    fn parses_closed_silence_ranges_as_integer_microseconds() {
        let ranges = parse_silence_ranges(
            b"[silencedetect] silence_start: 1.25\n[silencedetect] silence_end: 2.5 | silence_duration: 1.25\n",
            5_000_000,
        )
        .expect("valid silence output");

        assert_eq!(
            ranges,
            [SilenceRange {
                start_micros: 1_250_000,
                end_micros: 2_500_000,
            }]
        );
    }

    #[test]
    fn ignores_open_ended_and_invalid_ranges() {
        let ranges = parse_silence_ranges(
            b"silence_end: 2 | silence_duration: 2\nsilence_start: NaN\nsilence_end: 4\nsilence_start: 5\n",
            4_000_000,
        )
        .expect("partial log output is safe");

        assert!(ranges.is_empty());
    }

    #[test]
    fn closes_trailing_silence_at_the_source_duration() {
        let ranges = parse_silence_ranges(b"silence_start: 3.5\n", 4_000_000)
            .expect("trailing silence is bounded by the inspected duration");

        assert_eq!(
            ranges,
            [SilenceRange {
                start_micros: 3_500_000,
                end_micros: 4_000_000,
            }]
        );
    }

    #[test]
    fn builds_a_filter_for_the_selected_tracks_and_gains() {
        let args = silence_detection_arguments(Path::new("input.mp4"), &[(2, 50), (4, 25)], false);
        let args = args
            .iter()
            .map(|arg| arg.to_string_lossy())
            .collect::<Vec<_>>();
        let filter = args
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .expect("filter complex argument exists")[1]
            .to_string();

        assert!(filter.contains("[0:2]aformat=channel_layouts=mono,volume=1.000[audio0]"));
        assert!(filter.contains("[0:4]aformat=channel_layouts=mono,volume=0.500[audio1]"));
        assert!(filter.contains("amix=inputs=2:normalize=0:duration=longest,silencedetect"));
    }

    #[test]
    fn detection_uses_export_mix_normalization_when_audio_is_merged() {
        let args = silence_detection_arguments(Path::new("input.mp4"), &[(2, 50), (4, 25)], true);
        let filter = args
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .map(|pair| pair[1].to_string_lossy())
            .expect("filter graph exists");

        assert!(filter.contains("amix=inputs=2:normalize=1:duration=longest,silencedetect"));
    }
}
