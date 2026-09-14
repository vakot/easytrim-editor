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
    media::probe::inspect_media_cancellable,
    process::{ProcessOutput, run_bounded_cancellable},
    state::PreviewArtifact,
};

const THUMBNAIL_WIDTH: u32 = 480;
const THUMBNAIL_TIMEOUT: Duration = Duration::from_secs(60);
const THUMBNAIL_STDOUT_LIMIT: usize = 16 * 1024;
const THUMBNAIL_STDERR_LIMIT: usize = 128 * 1024;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

pub fn generate_thumbnail(source_path: &Path) -> Result<PreviewArtifact, AppError> {
    let media = inspect_media_cancellable(source_path, || false)?;
    let artifact = create_artifact()?;
    let arguments = thumbnail_arguments(source_path, media.video.stream_index, artifact.path());
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        THUMBNAIL_TIMEOUT,
        THUMBNAIL_STDOUT_LIMIT,
        THUMBNAIL_STDERR_LIMIT,
        || false,
    )
    .map_err(process_error)?;

    if output.status.success() && artifact.path().is_file() {
        return Ok(artifact);
    }

    Err(AppError::preview_failed(
        "A thumbnail could not be prepared for this video.",
        diagnostics(&output, source_path, artifact.path()),
    ))
}

fn thumbnail_arguments(
    source_path: &Path,
    video_stream_index: u32,
    output_path: &Path,
) -> Vec<OsString> {
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-nostats"),
        OsString::from("-threads"),
        OsString::from("1"),
        OsString::from("-filter_threads"),
        OsString::from("1"),
        OsString::from("-filter_complex_threads"),
        OsString::from("1"),
        OsString::from("-n"),
        OsString::from("-ss"),
        OsString::from("0"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-map"),
        OsString::from(format!("0:{video_stream_index}")),
        OsString::from("-frames:v"),
        OsString::from("1"),
        OsString::from("-vf"),
        OsString::from(format!("scale=w='min({THUMBNAIL_WIDTH},iw)':h=-2")),
        OsString::from("-an"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-c:v"),
        OsString::from("mjpeg"),
        OsString::from("-q:v"),
        OsString::from("5"),
        OsString::from("-f"),
        OsString::from("image2"),
        output_path.as_os_str().to_owned(),
    ]
}

fn create_artifact() -> Result<PreviewArtifact, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let base_directory = std::env::temp_dir();

    for _ in 0..100 {
        let sequence = NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
        let directory = base_directory.join(format!(
            "easytrim-thumbnail-{}-{timestamp}-{sequence}",
            process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => {
                return PreviewArtifact::new(directory.clone(), directory.join("thumbnail.jpg"));
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(_) => {
                return Err(AppError::io_failed(
                    "A temporary thumbnail directory could not be created.",
                ));
            }
        }
    }

    Err(AppError::io_failed(
        "A unique temporary thumbnail directory could not be created.",
    ))
}

fn process_error(error: io::Error) -> AppError {
    let message = match error.kind() {
        io::ErrorKind::NotFound => "FFmpeg is required to prepare source thumbnails.",
        io::ErrorKind::TimedOut => "Preparing a source thumbnail took too long.",
        _ => "FFmpeg could not prepare a source thumbnail.",
    };
    AppError::preview_failed(message, None::<String>)
}

fn diagnostics(
    output: &ProcessOutput,
    source_path: &Path,
    thumbnail_path: &Path,
) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr);
    let value = value
        .replace(source_path.to_string_lossy().as_ref(), "<source>")
        .replace(thumbnail_path.to_string_lossy().as_ref(), "<thumbnail>");
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
    use std::path::Path;

    use super::thumbnail_arguments;

    #[test]
    fn extracts_one_bounded_jpeg_frame_from_the_probed_video_stream() {
        let arguments = thumbnail_arguments(
            Path::new("C:\\Media\\clip.mp4"),
            2,
            Path::new("C:\\Temp\\thumbnail.jpg"),
        );
        let arguments = arguments
            .iter()
            .map(|argument| argument.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        assert!(arguments.windows(2).any(|pair| pair == ["-map", "0:2"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-frames:v", "1"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-c:v", "mjpeg"]));
        assert!(arguments
            .iter()
            .any(|argument| argument.ends_with("thumbnail.jpg")));
    }
}
