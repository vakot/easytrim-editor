use std::{
    ffi::{OsStr, OsString},
    fs, io,
    path::Path,
    process,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use crate::{
    error::AppError,
    process::{ProcessOutput, run_bounded_cancellable},
    state::{ActiveSource, AudioPreviewArtifact},
};

const AUDIO_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const STDERR_LIMIT: usize = 128 * 1024;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

pub fn generate_audio_preview(
    source: &ActiveSource,
    stream_index: u32,
) -> Result<AudioPreviewArtifact, AppError> {
    if !source.audio_stream_indexes.contains(&stream_index) {
        return Err(AppError::invalid_request(format!(
            "Audio stream #{stream_index} does not belong to the active source."
        )));
    }

    let artifact = create_artifact(stream_index)?;
    let arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-n"),
        OsString::from("-i"),
        source.path.as_os_str().to_owned(),
        OsString::from("-map"),
        OsString::from(format!("0:{stream_index}")),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-c:a"),
        OsString::from("copy"),
        OsString::from("-movflags"),
        OsString::from("+faststart"),
        OsString::from("-f"),
        OsString::from("mp4"),
        artifact.path().as_os_str().to_owned(),
    ];
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        AUDIO_TIMEOUT,
        16 * 1024,
        STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
    )
    .map_err(process_error)?;

    if output.status.success() && artifact.path().is_file() {
        return Ok(artifact);
    }

    Err(AppError::preview_failed(
        format!("Audio stream #{stream_index} could not be prepared for preview."),
        diagnostics(&output, &source.path, artifact.path()),
    ))
}

fn create_artifact(stream_index: u32) -> Result<AudioPreviewArtifact, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let base_directory = std::env::temp_dir();

    for _ in 0..100 {
        let sequence = NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
        let directory = base_directory.join(format!(
            "clipkit-audio-preview-{}-{timestamp}-{sequence}",
            process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => {
                let path = directory.join(format!("audio-{stream_index}.m4a"));
                return AudioPreviewArtifact::new(directory, path);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(_) => {
                return Err(AppError::io_failed(
                    "A temporary audio preview directory could not be created.",
                ));
            }
        }
    }

    Err(AppError::io_failed(
        "A unique temporary audio preview directory could not be created.",
    ))
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::source_replaced(),
        io::ErrorKind::NotFound => AppError::preview_failed(
            "FFmpeg is required to prepare audio preview.",
            None::<String>,
        ),
        io::ErrorKind::TimedOut => {
            AppError::preview_failed("Preparing audio preview took too long.", None::<String>)
        }
        _ => AppError::preview_failed("FFmpeg could not prepare audio preview.", None::<String>),
    }
}

fn diagnostics(output: &ProcessOutput, source_path: &Path, preview_path: &Path) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr)
        .replace(source_path.to_string_lossy().as_ref(), "<source>")
        .replace(preview_path.to_string_lossy().as_ref(), "<preview>");
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}
