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
    process::{ProcessOutput, media_debug, run_bounded_cancellable},
    state::{ActiveSource, PreviewArtifact, PreviewStreamSelection},
};

const PROXY_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const PROXY_STDOUT_LIMIT: usize = 16 * 1024;
const PROXY_STDERR_LIMIT: usize = 128 * 1024;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

pub fn generate_preview(source: &ActiveSource) -> Result<PreviewArtifact, AppError> {
    let streams = source.preview_streams.ok_or_else(|| {
        AppError::invalid_request("Inspect the video before preparing its preview.")
    })?;
    let artifact = create_artifact()?;

    if cfg!(target_os = "macos") && can_remux_preview(source) {
        media_debug(format_args!(
            "preview: trying fast remux source_id={}",
            source.source_id
        ));
        match run_remux(source, streams, artifact.path()) {
            Ok(output) if output.status.success() => {
                media_debug("preview: fast remux succeeded");
                return Ok(artifact);
            }
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {
                return Err(AppError::source_replaced());
            }
            _ => {
                media_debug("preview: fast remux failed; falling back to encoded preview");
                let _ = fs::remove_file(artifact.path());
            }
        }
    }

    let hardware_encoder = if cfg!(target_os = "macos") {
        Encoder::VideoToolbox
    } else {
        Encoder::Nvidia
    };
    media_debug(format_args!(
        "preview: trying preferred encoder={} source_id={}",
        hardware_encoder.name(),
        source.source_id
    ));
    let hardware_result = run_encoder(source, streams, artifact.path(), hardware_encoder);
    match hardware_result {
        Ok(output) if output.status.success() => {
            media_debug(format_args!(
                "preview: preferred encoder={} succeeded",
                hardware_encoder.name()
            ));
            return Ok(artifact);
        }
        Err(error) if error.kind() == io::ErrorKind::Interrupted => {
            return Err(AppError::source_replaced());
        }
        _ => {
            media_debug(format_args!(
                "preview: preferred encoder={} failed; falling back to software",
                hardware_encoder.name()
            ));
            let _ = fs::remove_file(artifact.path());
        }
    }

    let output =
        run_encoder(source, streams, artifact.path(), Encoder::Software).map_err(process_error)?;
    if output.status.success() {
        return Ok(artifact);
    }

    Err(AppError::preview_failed(
        "A compatible preview could not be prepared for this video.",
        diagnostics(&output, &source.path, artifact.path()),
    ))
}

fn can_remux_preview(source: &ActiveSource) -> bool {
    source
        .media
        .as_ref()
        .is_some_and(|media| matches!(media.video.codec_name.as_str(), "h264" | "hevc" | "h265"))
}

#[derive(Clone, Copy)]
enum Encoder {
    Nvidia,
    VideoToolbox,
    Software,
}

impl Encoder {
    fn name(self) -> &'static str {
        match self {
            Self::Nvidia => "h264_nvenc",
            Self::VideoToolbox => "h264_videotoolbox",
            Self::Software => "libx264",
        }
    }
}

fn run_encoder(
    source: &ActiveSource,
    streams: PreviewStreamSelection,
    output_path: &Path,
    encoder: Encoder,
) -> io::Result<ProcessOutput> {
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-n"),
        OsString::from("-i"),
        source.path.as_os_str().to_owned(),
        OsString::from("-map"),
        OsString::from(format!("0:{}", streams.video_stream_index)),
    ];
    if let Some(audio_stream_index) = streams.audio_stream_index {
        arguments.extend([
            OsString::from("-map"),
            OsString::from(format!("0:{audio_stream_index}")),
        ]);
    } else {
        arguments.push(OsString::from("-an"));
    }
    arguments.extend([
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-vf"),
        OsString::from("scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2"),
        OsString::from("-pix_fmt"),
        OsString::from("yuv420p"),
        OsString::from("-c:v"),
    ]);
    match encoder {
        Encoder::Nvidia => arguments.extend([
            OsString::from("h264_nvenc"),
            OsString::from("-preset"),
            OsString::from("p1"),
            OsString::from("-cq"),
            OsString::from("30"),
            OsString::from("-b:v"),
            OsString::from("0"),
        ]),
        Encoder::VideoToolbox => arguments.extend([
            OsString::from("h264_videotoolbox"),
            OsString::from("-allow_sw"),
            OsString::from("1"),
            OsString::from("-b:v"),
            OsString::from("4M"),
        ]),
        Encoder::Software => arguments.extend([
            OsString::from("libx264"),
            OsString::from("-preset"),
            OsString::from("ultrafast"),
            OsString::from("-crf"),
            OsString::from("28"),
        ]),
    }
    if streams.audio_stream_index.is_some() {
        arguments.extend([
            OsString::from("-c:a"),
            OsString::from("aac"),
            OsString::from("-b:a"),
            OsString::from("128k"),
        ]);
    }
    arguments.extend([
        OsString::from("-movflags"),
        OsString::from("+faststart"),
        OsString::from("-f"),
        OsString::from("mp4"),
        output_path.as_os_str().to_owned(),
    ]);

    run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        PROXY_TIMEOUT,
        PROXY_STDOUT_LIMIT,
        PROXY_STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
    )
}

fn run_remux(
    source: &ActiveSource,
    streams: PreviewStreamSelection,
    output_path: &Path,
) -> io::Result<ProcessOutput> {
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-n"),
        OsString::from("-i"),
        source.path.as_os_str().to_owned(),
        OsString::from("-map"),
        OsString::from(format!("0:{}", streams.video_stream_index)),
    ];
    if let Some(audio_stream_index) = streams.audio_stream_index {
        arguments.extend([
            OsString::from("-map"),
            OsString::from(format!("0:{audio_stream_index}")),
        ]);
    }
    arguments.extend([
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-c"),
        OsString::from("copy"),
    ]);
    if source
        .media
        .as_ref()
        .is_some_and(|media| matches!(media.video.codec_name.as_str(), "hevc" | "h265"))
    {
        arguments.extend([OsString::from("-tag:v"), OsString::from("hvc1")]);
    }
    arguments.extend([
        OsString::from("-movflags"),
        OsString::from("+faststart"),
        OsString::from("-f"),
        OsString::from("mp4"),
        output_path.as_os_str().to_owned(),
    ]);

    run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        PROXY_TIMEOUT,
        PROXY_STDOUT_LIMIT,
        PROXY_STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
    )
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
            "easytrim-preview-{}-{timestamp}-{sequence}",
            process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => {
                let path = directory.join("preview.mp4");
                return PreviewArtifact::new(directory, path);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(_) => {
                return Err(AppError::io_failed(
                    "A temporary preview directory could not be created.",
                ));
            }
        }
    }

    Err(AppError::io_failed(
        "A unique temporary preview directory could not be created.",
    ))
}

fn process_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::source_replaced(),
        io::ErrorKind::NotFound => AppError::preview_failed(
            "FFmpeg is required to prepare a compatible preview.",
            None::<String>,
        ),
        io::ErrorKind::TimedOut => AppError::preview_failed(
            "Preparing the compatible preview took too long.",
            None::<String>,
        ),
        _ => AppError::preview_failed(
            "FFmpeg could not prepare a compatible preview.",
            None::<String>,
        ),
    }
}

fn diagnostics(output: &ProcessOutput, source_path: &Path, preview_path: &Path) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr);
    let value = value
        .replace(source_path.to_string_lossy().as_ref(), "<source>")
        .replace(preview_path.to_string_lossy().as_ref(), "<preview>");
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

    use super::diagnostics;
    use crate::process::ProcessOutput;

    #[cfg(windows)]
    fn successful_status() -> std::process::ExitStatus {
        use std::os::windows::process::ExitStatusExt;

        std::process::ExitStatus::from_raw(0)
    }

    #[cfg(unix)]
    fn successful_status() -> std::process::ExitStatus {
        use std::os::unix::process::ExitStatusExt;

        std::process::ExitStatus::from_raw(0)
    }

    #[test]
    fn diagnostics_do_not_expose_source_or_preview_paths() {
        let output = ProcessOutput {
            status: successful_status(),
            stdout: Vec::new(),
            stderr: b"failed C:\\private\\source.mkv -> C:\\temp\\preview.mp4".to_vec(),
            stdout_truncated: false,
            stderr_truncated: false,
        };

        let value = diagnostics(
            &output,
            Path::new("C:\\private\\source.mkv"),
            Path::new("C:\\temp\\preview.mp4"),
        )
        .expect("diagnostics exist");

        assert_eq!(value, "failed <source> -> <preview>");
    }
}
