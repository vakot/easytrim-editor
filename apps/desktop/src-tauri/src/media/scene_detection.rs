use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    sync::atomic::Ordering,
    time::Duration,
};

use crate::{
    error::AppError,
    process::{ProcessOutput, run_bounded_cancellable},
    state::ActiveSource,
};

const SCENE_THRESHOLD: f64 = 0.3;
const SCENE_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const SCENE_STDOUT_LIMIT: usize = 16 * 1024;
const SCENE_STDERR_LIMIT: usize = 4 * 1024 * 1024;
const MAX_SCENE_BOUNDARIES: usize = 20_000;

pub fn detect_scene_boundaries(source: &ActiveSource) -> Result<Vec<u64>, AppError> {
    let Some(media) = source.media.as_ref() else {
        return Err(AppError::invalid_request(
            "The active source has not been inspected.",
        ));
    };
    let arguments = scene_detection_arguments(&source.path, media.video.stream_index);
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        SCENE_TIMEOUT,
        SCENE_STDOUT_LIMIT,
        SCENE_STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
    )
    .map_err(process_error)?;

    if !output.status.success() {
        return Err(AppError::scene_detection_failed(
            "FFmpeg could not detect scene changes.",
            diagnostics(&output, &source.path),
        ));
    }
    if output.stderr_truncated {
        return Err(AppError::scene_detection_failed(
            "The scene detection output exceeded its safety limit.",
            None::<String>,
        ));
    }

    parse_scene_timestamps(&output.stderr)
}

fn scene_detection_arguments(source_path: &Path, stream_index: u32) -> Vec<OsString> {
    [
        OsString::from("-hide_banner"),
        OsString::from("-nostats"),
        OsString::from("-v"),
        OsString::from("info"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-map"),
        OsString::from(format!("0:{stream_index}")),
        OsString::from("-vf"),
        OsString::from(format!(
            "setpts=PTS-STARTPTS,select='gt(scene,{SCENE_THRESHOLD})',showinfo"
        )),
        OsString::from("-an"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("null"),
        OsString::from("-"),
    ]
    .into()
}

fn parse_scene_timestamps(stderr: &[u8]) -> Result<Vec<u64>, AppError> {
    let mut timestamps_micros = Vec::new();
    for line in String::from_utf8_lossy(stderr).lines() {
        let Some(value) = line.split_once("pts_time:").map(|(_, value)| value) else {
            continue;
        };
        let Some(seconds) = value
            .split_whitespace()
            .next()
            .and_then(|value| value.parse::<f64>().ok())
        else {
            continue;
        };
        if !seconds.is_finite() || seconds < 0.0 {
            continue;
        }
        let timestamp = (seconds * 1_000_000.0).round();
        if !timestamp.is_finite() || timestamp > u64::MAX as f64 {
            continue;
        }
        let timestamp = timestamp as u64;
        if timestamps_micros
            .last()
            .is_none_or(|previous| *previous != timestamp)
        {
            timestamps_micros.push(timestamp);
            if timestamps_micros.len() > MAX_SCENE_BOUNDARIES {
                return Err(AppError::scene_detection_failed(
                    "The source contains too many detected scene changes.",
                    None::<String>,
                ));
            }
        }
    }
    Ok(timestamps_micros)
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::cancelled("Scene detection was interrupted."),
        io::ErrorKind::NotFound => AppError::scene_detection_failed(
            "FFmpeg is required to detect scene changes.",
            None::<String>,
        ),
        io::ErrorKind::TimedOut => {
            AppError::scene_detection_failed("Scene detection took too long.", None::<String>)
        }
        _ => AppError::scene_detection_failed(
            "FFmpeg could not detect scene changes.",
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
