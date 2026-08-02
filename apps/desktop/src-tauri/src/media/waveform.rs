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
    state::{WaveformArtifact, WaveformSource},
};

pub const MIN_WAVEFORM_WIDTH: u32 = 64;
pub const MAX_WAVEFORM_WIDTH: u32 = 4_096;
const WAVEFORM_HEIGHT: u32 = 56;
const WAVEFORM_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const WAVEFORM_STDOUT_LIMIT: usize = 16 * 1024;
const WAVEFORM_STDERR_LIMIT: usize = 128 * 1024;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);
pub type WaveformGenerationResult = (u32, Result<WaveformArtifact, AppError>);

pub fn generate_waveforms(
    source: &WaveformSource,
    stream_indexes: &[u32],
    width: u32,
) -> Result<Vec<WaveformGenerationResult>, AppError> {
    for stream_index in stream_indexes {
        validate_waveform_request(&source.source.audio_stream_indexes, *stream_index, width)?;
    }
    let artifacts = stream_indexes
        .iter()
        .map(|stream_index| {
            create_artifact(*stream_index).map(|artifact| (*stream_index, artifact))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let arguments = waveform_arguments(
        &source.source.path,
        stream_indexes,
        width,
        artifacts
            .iter()
            .map(|(_, artifact)| artifact.path())
            .collect::<Vec<_>>()
            .as_slice(),
    );
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        WAVEFORM_TIMEOUT,
        WAVEFORM_STDOUT_LIMIT,
        WAVEFORM_STDERR_LIMIT,
        || {
            source
                .source
                .cancellation
                .load(std::sync::atomic::Ordering::Acquire)
                || source
                    .cancellation
                    .load(std::sync::atomic::Ordering::Acquire)
        },
    )
    .map_err(process_error)?;

    if output.status.success() {
        return Ok(artifacts
            .into_iter()
            .map(|(stream_index, artifact)| {
                if artifact.path().is_file() {
                    (stream_index, Ok(artifact))
                } else {
                    (
                        stream_index,
                        Err(AppError::waveform_failed(
                            format!(
                                "Waveform generation produced no image for audio stream #{stream_index}."
                            ),
                            None::<String>,
                        )),
                    )
                }
            })
            .collect());
    }

    let diagnostics = diagnostics(
        &output,
        &source.source.path,
        artifacts.iter().map(|(_, artifact)| artifact.path()),
    );
    Ok(artifacts
        .into_iter()
        .map(|(stream_index, _)| {
            (
                stream_index,
                Err(AppError::waveform_failed(
                    format!("Waveform generation failed for audio stream #{stream_index}."),
                    diagnostics.clone(),
                )),
            )
        })
        .collect())
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

fn waveform_arguments(
    source_path: &Path,
    stream_indexes: &[u32],
    width: u32,
    output_paths: &[&Path],
) -> Vec<OsString> {
    let filters = stream_indexes
        .iter()
        .enumerate()
        .map(|(index, stream_index)| {
            format!(
                "[0:{stream_index}]aformat=channel_layouts=mono,showwavespic=s={width}x{WAVEFORM_HEIGHT}:colors=0x8b5cf6:scale=sqrt[waveform{index}]"
            )
        })
        .collect::<Vec<_>>()
        .join(";");
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-n"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-filter_complex"),
        OsString::from(filters),
    ];
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

fn create_artifact(stream_index: u32) -> Result<WaveformArtifact, AppError> {
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
                let path = directory.join(format!("audio-{stream_index}.png"));
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
    use std::{ffi::OsString, path::Path};

    use super::{
        MAX_WAVEFORM_WIDTH, MIN_WAVEFORM_WIDTH, validate_waveform_request, waveform_arguments,
    };

    #[test]
    fn validates_global_audio_stream_indexes_and_bounded_widths() {
        assert!(validate_waveform_request(&[2, 4], 2, 1_200).is_ok());
        assert!(validate_waveform_request(&[2, 4], 3, 1_200).is_err());
        assert!(validate_waveform_request(&[2], 2, MIN_WAVEFORM_WIDTH - 1).is_err());
        assert!(validate_waveform_request(&[2], 2, MAX_WAVEFORM_WIDTH + 1).is_err());
    }

    #[test]
    fn builds_a_shell_free_stream_specific_waveform_command() {
        let arguments = waveform_arguments(
            Path::new("C:\\Videos\\source clip.mkv"),
            &[2, 4],
            1_280,
            &[
                Path::new("C:\\Temp\\audio-2.png"),
                Path::new("C:\\Temp\\audio-4.png"),
            ],
        );

        assert!(arguments.windows(2).any(|pair| {
            pair == [
                OsString::from("-i"),
                OsString::from("C:\\Videos\\source clip.mkv"),
            ]
        }));
        assert!(arguments.iter().any(|argument| {
            argument == "[0:2]aformat=channel_layouts=mono,showwavespic=s=1280x56:colors=0x8b5cf6:scale=sqrt[waveform0];[0:4]aformat=channel_layouts=mono,showwavespic=s=1280x56:colors=0x8b5cf6:scale=sqrt[waveform1]"
        }));
        assert_eq!(
            arguments
                .windows(2)
                .filter(|pair| pair[0] == "-map")
                .map(|pair| pair[1].clone())
                .collect::<Vec<_>>(),
            [OsString::from("[waveform0]"), OsString::from("[waveform1]")]
        );
    }
}
