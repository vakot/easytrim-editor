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
    media::export::{AudioTrackSelection, audio_filter_graph, validate_audio_track_selections},
    process::{ProcessOutput, run_bounded_cancellable},
    state::{ActiveSource, AudioPreviewArtifact},
};

const AUDIO_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const STDERR_LIMIT: usize = 128 * 1024;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

pub fn generate_audio_previews(
    source: &ActiveSource,
    audio_tracks: &[AudioTrackSelection],
) -> Result<Vec<(AudioTrackSelection, AudioPreviewArtifact)>, AppError> {
    let media = source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request("Audio previews require inspected source media.")
    })?;
    validate_audio_track_selections(media, audio_tracks)?;

    let artifacts = audio_tracks
        .iter()
        .map(|track| create_artifact(track.stream_index).map(|artifact| (track.clone(), artifact)))
        .collect::<Result<Vec<_>, _>>()?;
    let arguments = audio_preview_arguments(
        &source.path,
        audio_tracks,
        &artifacts
            .iter()
            .map(|(_, artifact)| artifact.path())
            .collect::<Vec<_>>(),
    );
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        AUDIO_TIMEOUT,
        16 * 1024,
        STDERR_LIMIT,
        || source.cancellation.load(Ordering::Acquire),
    )
    .map_err(process_error)?;

    if output.status.success()
        && artifacts
            .iter()
            .all(|(_, artifact)| artifact.path().is_file())
    {
        return Ok(artifacts);
    }

    Err(AppError::preview_failed(
        "The selected audio streams could not be prepared for preview.",
        diagnostics(
            &output,
            &source.path,
            artifacts.iter().map(|(_, artifact)| artifact.path()),
        ),
    ))
}

fn audio_preview_arguments(
    source_path: &Path,
    audio_tracks: &[AudioTrackSelection],
    outputs: &[&Path],
) -> Vec<OsString> {
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-n"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-filter_complex"),
        OsString::from(audio_filter_graph(audio_tracks, false)),
    ];
    for (index, output_path) in outputs.iter().enumerate() {
        arguments.extend([
            OsString::from("-map"),
            OsString::from(format!("[audio{index}]")),
            OsString::from("-vn"),
            OsString::from("-sn"),
            OsString::from("-dn"),
            OsString::from("-c:a"),
            OsString::from("aac"),
            OsString::from("-f"),
            OsString::from("mp4"),
            output_path.as_os_str().to_owned(),
        ]);
    }
    arguments
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
            "easytrim-audio-preview-{}-{timestamp}-{sequence}",
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

fn diagnostics<'a>(
    output: &ProcessOutput,
    source_path: &Path,
    preview_paths: impl IntoIterator<Item = &'a Path>,
) -> Option<String> {
    let mut value = String::from_utf8_lossy(&output.stderr)
        .replace(source_path.to_string_lossy().as_ref(), "<source>");
    for preview_path in preview_paths {
        value = value.replace(preview_path.to_string_lossy().as_ref(), "<preview>");
    }
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, path::Path};

    use crate::media::export::{AudioTrackProcessing, AudioTrackSelection, LoudnessPreset};

    use super::audio_preview_arguments;

    #[test]
    fn builds_one_input_with_multiple_audio_outputs() {
        let tracks = [
            AudioTrackSelection {
                stream_index: 2,
                processing: AudioTrackProcessing {
                    gain_db: 3.0,
                    loudness_normalization: Some(LoudnessPreset::Streaming),
                },
            },
            AudioTrackSelection {
                stream_index: 4,
                processing: AudioTrackProcessing {
                    gain_db: 0.0,
                    loudness_normalization: None,
                },
            },
        ];
        let arguments = audio_preview_arguments(
            Path::new("C:\\Videos\\source clip.mkv"),
            &tracks,
            &[
                Path::new("C:\\Temp\\audio-2.m4a"),
                Path::new("C:\\Temp\\audio-4.m4a"),
            ],
        );

        assert_eq!(
            arguments
                .iter()
                .filter(|argument| *argument == "-i")
                .count(),
            1
        );
        assert_eq!(
            arguments
                .windows(2)
                .filter(|pair| pair[0] == "-map")
                .map(|pair| pair[1].clone())
                .collect::<Vec<_>>(),
            [OsString::from("[audio0]"), OsString::from("[audio1]")]
        );
        let filter = arguments
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .map(|pair| pair[1].to_string_lossy())
            .expect("filter graph exists");
        assert!(filter.contains("[0:2]loudnorm=I=-16:TP=-1.5:LRA=11[track0_normalized]"));
        assert!(filter.contains("[track0_normalized]volume=3.000000dB[audio0]"));
        assert!(filter.contains(
            "[0:4]anull[track1_normalized];[track1_normalized]volume=0.000000dB[audio1]"
        ));
        assert_eq!(
            arguments
                .iter()
                .filter(|argument| *argument == "-c:a")
                .count(),
            2
        );
        assert!(arguments.contains(&OsString::from("aac")));
    }
}
