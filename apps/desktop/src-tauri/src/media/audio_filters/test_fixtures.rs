//! Generated audio fixtures and PCM helpers for FFmpeg-backed tests.

use std::{
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
    sync::{Arc, atomic::AtomicBool},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use crate::{
    media::probe::{AudioStream, MediaInfo, VideoStream},
    process::run_bounded,
    state::ActiveSource,
};

/// Program-like material covering the signal shapes that expose processing differences:
/// leading silence, transient clicks, a sustained tone, pink noise, and loudness steps.
pub const PROGRAM_MATERIAL: &str = "aevalsrc=exprs='if(lt(t,0.5),0,\
(0.6*between(mod(t,1.25),0.5,0.502)+0.15*sin(2*PI*220*t)+0.05*sin(2*PI*3100*t))\
*if(lt(t,3),0.2,if(lt(t,5),1,0.4)))':s=48000:d=8:c=stereo";

/// Writes a fixture from an FFmpeg lavfi source expression with the given audio codec.
pub fn generate_fixture(name: &str, source: &str, extension: &str, codec: &str) -> FixtureFile {
    let unique_id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time is valid")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "easytrim-audio-filters-{name}-{}-{unique_id}.{extension}",
        std::process::id()
    ));
    let output = run_bounded(
        OsStr::new("ffmpeg"),
        &[
            OsString::from("-hide_banner"),
            OsString::from("-nostdin"),
            OsString::from("-v"),
            OsString::from("error"),
            OsString::from("-f"),
            OsString::from("lavfi"),
            OsString::from("-i"),
            OsString::from(source),
            OsString::from("-c:a"),
            OsString::from(codec),
            OsString::from("-y"),
            path.as_os_str().to_owned(),
        ],
        Duration::from_secs(30),
        16 * 1024,
        64 * 1024,
    )
    .expect("FFmpeg generates the audio fixture");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    FixtureFile { path }
}

/// Runs FFmpeg with the given input/filter arguments and returns interleaved f32 stereo PCM.
pub fn decode_f32_stereo(arguments: &[OsString]) -> Vec<f32> {
    let mut arguments = [
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-v"),
        OsString::from("error"),
    ]
    .into_iter()
    .chain(arguments.iter().cloned())
    .collect::<Vec<_>>();
    arguments.extend([
        OsString::from("-f"),
        OsString::from("f32le"),
        OsString::from("-ac"),
        OsString::from("2"),
        OsString::from("-ar"),
        OsString::from("48000"),
        OsString::from("pipe:1"),
    ]);
    let output = run_bounded(
        OsStr::new("ffmpeg"),
        &arguments,
        Duration::from_secs(60),
        512 * 1024 * 1024,
        64 * 1024,
    )
    .expect("FFmpeg decodes reference PCM");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output
        .stdout
        .chunks_exact(4)
        .map(|sample| f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]))
        .collect()
}

/// An inspected source whose only audio stream is stream 0 (stereo, 48 kHz).
pub fn fixture_source(path: &Path, duration_micros: i64) -> ActiveSource {
    ActiveSource {
        load_token: 1,
        path: path.to_owned(),
        cancellation: Arc::new(AtomicBool::new(false)),
        media: Some(fixture_media(duration_micros)),
        preview_streams: None,
        audio_stream_indexes: vec![0],
    }
}

fn fixture_media(duration_micros: i64) -> MediaInfo {
    MediaInfo {
        format_name: "wav".to_owned(),
        format_long_name: None,
        duration_micros,
        start_time_micros: Some(0),
        size_bytes: None,
        bitrate: None,
        video: VideoStream {
            stream_index: 1,
            codec_name: "none".to_owned(),
            width: 1,
            height: 1,
            coded_width: None,
            coded_height: None,
            sample_aspect_ratio: None,
            pixel_format: None,
            color_space: None,
            color_transfer: None,
            color_primaries: None,
            time_base: None,
            average_frame_rate: None,
            real_frame_rate: None,
            frame_count: None,
            rotation_degrees: None,
            frame_timestamps_micros: Vec::new(),
        },
        audio_streams: vec![AudioStream {
            stream_index: 0,
            codec_name: "pcm_s16le".to_owned(),
            channels: Some(2),
            channel_layout: Some("stereo".to_owned()),
            sample_rate_hz: Some(48_000),
            start_time_micros: Some(0),
            duration_micros: Some(duration_micros),
            language: None,
            title: None,
            is_default: true,
        }],
        chapters: Vec::new(),
    }
}

pub fn max_difference(left: &[f32], right: &[f32]) -> f32 {
    assert_eq!(left.len(), right.len(), "compared PCM lengths differ");
    left.iter()
        .zip(right)
        .map(|(left, right)| (left - right).abs())
        .fold(0.0, f32::max)
}

pub struct FixtureFile {
    path: PathBuf,
}

impl FixtureFile {
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for FixtureFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}
