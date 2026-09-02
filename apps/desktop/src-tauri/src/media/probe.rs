use std::{
    collections::HashMap,
    ffi::{OsStr, OsString},
    io,
    path::Path,
    time::Duration,
};

use serde::{Deserialize, Serialize};

use crate::{error::AppError, process::run_bounded_cancellable};

const PROBE_TIMEOUT: Duration = Duration::from_secs(20);
const PROBE_STDOUT_LIMIT: usize = 2 * 1024 * 1024;
const PROBE_STDERR_LIMIT: usize = 32 * 1024;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameRate {
    pub numerator: u64,
    pub denominator: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_value: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStream {
    pub stream_index: u32,
    pub codec_name: String,
    pub width: u32,
    pub height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coded_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coded_height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_aspect_ratio: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pixel_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_transfer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_primaries: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_base: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub average_frame_rate: Option<FrameRate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub real_frame_rate: Option<FrameRate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation_degrees: Option<i32>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStream {
    pub stream_index: u32,
    pub codec_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_layout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate_hz: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub is_default: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterInfo {
    pub id: i64,
    pub start_micros: i64,
    pub end_micros: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub format_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_long_name: Option<String>,
    pub duration_micros: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_time_micros: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u64>,
    pub video: VideoStream,
    pub audio_streams: Vec<AudioStream>,
    pub chapters: Vec<ChapterInfo>,
}

pub fn inspect_media_cancellable(
    path: &Path,
    is_cancelled: impl FnMut() -> bool,
) -> Result<MediaInfo, AppError> {
    let arguments = [
        OsString::from("-v"),
        OsString::from("error"),
        OsString::from("-of"),
        OsString::from("json"),
        OsString::from("-show_format"),
        OsString::from("-show_streams"),
        OsString::from("-show_chapters"),
        path.as_os_str().to_owned(),
    ];

    let output = run_bounded_cancellable(
        OsStr::new("ffprobe"),
        &arguments,
        PROBE_TIMEOUT,
        PROBE_STDOUT_LIMIT,
        PROBE_STDERR_LIMIT,
        is_cancelled,
    )
    .map_err(|error| map_probe_io_error(error, path))?;

    if !output.status.success() {
        return Err(AppError::probe_failed(
            "FFprobe could not inspect this video.",
            diagnostics(&output.stderr, output.stderr_truncated, path),
        ));
    }

    if output.stdout_truncated {
        return Err(AppError::probe_failed(
            "This video contains more metadata than the inspection limit allows.",
            None::<String>,
        ));
    }

    parse_probe_output(&output.stdout)
}

fn parse_probe_output(output: &[u8]) -> Result<MediaInfo, AppError> {
    let probe: ProbeDocument = serde_json::from_slice(output).map_err(|error| {
        AppError::probe_failed(
            "FFprobe returned unreadable metadata.",
            Some(format!("JSON parse error: {error}")),
        )
    })?;

    let primary_video = probe
        .streams
        .iter()
        .filter(|stream| {
            stream.codec_type.as_deref() == Some("video")
                && stream
                    .disposition
                    .as_ref()
                    .is_none_or(|value| value.attached_pic == 0)
        })
        .max_by_key(|stream| {
            (
                stream.disposition.as_ref().map_or(0, |value| value.default),
                std::cmp::Reverse(stream.index),
            )
        })
        .ok_or_else(|| AppError::unsupported_media("No usable video stream was found."))?;

    let format = probe.format.unwrap_or_default();
    let duration_micros = primary_video
        .duration
        .as_deref()
        .and_then(parse_seconds_to_micros)
        .or_else(|| format.duration.as_deref().and_then(parse_seconds_to_micros))
        .filter(|duration| *duration > 0)
        .ok_or_else(|| AppError::unsupported_media("The video duration is unavailable."))?;

    let width = primary_video
        .width
        .filter(|value| *value > 0)
        .ok_or_else(|| AppError::unsupported_media("The video width is unavailable."))?;
    let height = primary_video
        .height
        .filter(|value| *value > 0)
        .ok_or_else(|| AppError::unsupported_media("The video height is unavailable."))?;
    let video = VideoStream {
        stream_index: primary_video.index,
        codec_name: primary_video
            .codec_name
            .clone()
            .unwrap_or_else(|| "unknown".to_owned()),
        width,
        height,
        coded_width: primary_video.coded_width,
        coded_height: primary_video.coded_height,
        sample_aspect_ratio: primary_video.sample_aspect_ratio.clone(),
        pixel_format: primary_video.pixel_format.clone(),
        color_space: primary_video.color_space.clone(),
        color_transfer: primary_video.color_transfer.clone(),
        color_primaries: primary_video.color_primaries.clone(),
        time_base: primary_video.time_base.clone(),
        average_frame_rate: primary_video
            .average_frame_rate
            .as_deref()
            .and_then(parse_frame_rate),
        real_frame_rate: primary_video
            .real_frame_rate
            .as_deref()
            .and_then(parse_frame_rate),
        rotation_degrees: rotation(primary_video),
    };

    let audio_streams = probe
        .streams
        .iter()
        .filter(|stream| stream.codec_type.as_deref() == Some("audio"))
        .map(|stream| AudioStream {
            stream_index: stream.index,
            codec_name: stream
                .codec_name
                .clone()
                .unwrap_or_else(|| "unknown".to_owned()),
            channels: stream.channels,
            channel_layout: stream.channel_layout.clone(),
            sample_rate_hz: stream
                .sample_rate
                .as_deref()
                .and_then(|value| value.parse().ok()),
            language: stream.tags.get("language").cloned(),
            title: stream.tags.get("title").cloned(),
            is_default: stream
                .disposition
                .as_ref()
                .is_some_and(|value| value.default != 0),
        })
        .collect();

    let chapters = probe
        .chapters
        .into_iter()
        .filter_map(|chapter| {
            Some(ChapterInfo {
                id: chapter.id,
                start_micros: parse_seconds_to_micros(&chapter.start_time)?,
                end_micros: parse_seconds_to_micros(&chapter.end_time)?,
                title: chapter.tags.get("title").cloned(),
            })
        })
        .collect();

    Ok(MediaInfo {
        format_name: format
            .format_name
            .clone()
            .unwrap_or_else(|| "Unknown container".to_owned()),
        format_long_name: format.format_long_name,
        duration_micros,
        start_time_micros: format
            .start_time
            .as_deref()
            .and_then(parse_seconds_to_micros),
        size_bytes: format.size.as_deref().and_then(|value| value.parse().ok()),
        bitrate: format
            .bit_rate
            .as_deref()
            .and_then(|value| value.parse().ok()),
        video,
        audio_streams,
        chapters,
    })
}

fn parse_frame_rate(value: &str) -> Option<FrameRate> {
    let (numerator, denominator) = value.split_once('/')?;
    let numerator = numerator.parse::<u64>().ok()?;
    let denominator = denominator.parse::<u64>().ok()?;
    if numerator == 0 || denominator == 0 {
        return None;
    }

    Some(FrameRate {
        numerator,
        denominator,
        display_value: Some(numerator as f64 / denominator as f64),
    })
}

fn parse_seconds_to_micros(value: &str) -> Option<i64> {
    let value = value.trim();
    let (negative, unsigned) = value
        .strip_prefix('-')
        .map_or((false, value), |remaining| (true, remaining));
    let (whole, fraction) = unsigned.split_once('.').unwrap_or((unsigned, ""));
    let whole = whole.parse::<i64>().ok()?;
    let mut fraction_micros = 0_i64;
    let mut digits = 0_u32;
    if !fraction.bytes().all(|digit| digit.is_ascii_digit()) {
        return None;
    }
    for digit in fraction.bytes().take(6) {
        fraction_micros = fraction_micros.checked_mul(10)? + i64::from(digit - b'0');
        digits += 1;
    }
    fraction_micros = fraction_micros.checked_mul(10_i64.pow(6 - digits))?;

    let micros = whole.checked_mul(1_000_000)?.checked_add(fraction_micros)?;
    Some(if negative { -micros } else { micros })
}

fn rotation(stream: &ProbeStream) -> Option<i32> {
    stream
        .side_data_list
        .iter()
        .find_map(|side_data| side_data.rotation)
        .or_else(|| {
            stream
                .tags
                .get("rotate")
                .and_then(|value| value.parse().ok())
        })
}

fn map_probe_io_error(error: io::Error, path: &Path) -> AppError {
    match error.kind() {
        io::ErrorKind::Interrupted => AppError::source_replaced(),
        io::ErrorKind::NotFound => AppError::probe_failed(
            "FFprobe is required to inspect video files.",
            Some("Install FFmpeg and make ffprobe available on PATH."),
        ),
        io::ErrorKind::TimedOut => AppError::probe_failed(
            "Video inspection exceeded the 20-second limit.",
            None::<String>,
        ),
        _ => AppError::probe_failed(
            "FFprobe could not be started.",
            Some(redact_source_path(&error.to_string(), path)),
        ),
    }
}

fn diagnostics(stderr: &[u8], truncated: bool, path: &Path) -> Option<String> {
    let raw = String::from_utf8_lossy(stderr);
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut diagnostics = redact_source_path(trimmed, path);
    if truncated {
        diagnostics.push_str("\n[diagnostics truncated]");
    }
    Some(diagnostics)
}

fn redact_source_path(message: &str, path: &Path) -> String {
    message.replace(&path.to_string_lossy().to_string(), "<source>")
}

#[derive(Debug, Default, Deserialize)]
struct ProbeDocument {
    #[serde(default)]
    streams: Vec<ProbeStream>,
    format: Option<ProbeFormat>,
    #[serde(default)]
    chapters: Vec<ProbeChapter>,
}

#[derive(Debug, Default, Deserialize)]
struct ProbeFormat {
    format_name: Option<String>,
    format_long_name: Option<String>,
    duration: Option<String>,
    start_time: Option<String>,
    size: Option<String>,
    bit_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProbeStream {
    index: u32,
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    coded_width: Option<u32>,
    coded_height: Option<u32>,
    sample_aspect_ratio: Option<String>,
    #[serde(rename = "pix_fmt")]
    pixel_format: Option<String>,
    color_space: Option<String>,
    color_transfer: Option<String>,
    color_primaries: Option<String>,
    time_base: Option<String>,
    #[serde(rename = "avg_frame_rate")]
    average_frame_rate: Option<String>,
    #[serde(rename = "r_frame_rate")]
    real_frame_rate: Option<String>,
    duration: Option<String>,
    channels: Option<u32>,
    channel_layout: Option<String>,
    sample_rate: Option<String>,
    #[serde(default)]
    tags: HashMap<String, String>,
    disposition: Option<ProbeDisposition>,
    #[serde(default)]
    side_data_list: Vec<ProbeSideData>,
}

#[derive(Debug, Deserialize)]
struct ProbeDisposition {
    #[serde(default)]
    default: i32,
    #[serde(default)]
    attached_pic: i32,
}

#[derive(Debug, Deserialize)]
struct ProbeSideData {
    rotation: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct ProbeChapter {
    id: i64,
    start_time: String,
    end_time: String,
    #[serde(default)]
    tags: HashMap<String, String>,
}

#[cfg(test)]
mod tests {
    use super::{parse_frame_rate, parse_probe_output, parse_seconds_to_micros};

    const PROBE_JSON: &[u8] = br#"{
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_type": "video",
          "width": 3840,
          "height": 2160,
          "coded_width": 3840,
          "coded_height": 2160,
          "sample_aspect_ratio": "1:1",
          "pix_fmt": "yuv420p",
          "color_space": "bt2020nc",
          "color_transfer": "smpte2084",
          "color_primaries": "bt2020",
          "time_base": "1/30000",
          "r_frame_rate": "30000/1001",
          "avg_frame_rate": "30000/1001",
          "duration": "12.345678",
          "disposition": { "default": 1, "attached_pic": 0 },
          "side_data_list": [{ "rotation": 90 }]
        },
        {
          "index": 2,
          "codec_name": "aac",
          "codec_type": "audio",
          "sample_rate": "48000",
          "channels": 6,
          "channel_layout": "5.1",
          "tags": { "language": "eng", "title": "Surround" },
          "disposition": { "default": 1, "attached_pic": 0 }
        }
      ],
      "chapters": [
        { "id": 1, "start_time": "0.000000", "end_time": "5.000000", "tags": { "title": "Intro" } }
      ],
      "format": {
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "format_long_name": "QuickTime / MOV",
        "start_time": "0.000000",
        "duration": "12.400000",
        "size": "123456",
        "bit_rate": "8000000"
      }
    }"#;

    #[test]
    fn parses_canonical_metadata_and_global_stream_indexes() {
        let info = parse_probe_output(PROBE_JSON).expect("metadata is valid");

        assert_eq!(info.duration_micros, 12_345_678);
        assert_eq!(info.video.stream_index, 0);
        assert_eq!(info.video.rotation_degrees, Some(90));
        assert_eq!(info.video.color_primaries.as_deref(), Some("bt2020"));
        assert_eq!(info.audio_streams[0].stream_index, 2);
        assert_eq!(info.audio_streams[0].language.as_deref(), Some("eng"));
        assert!(info.audio_streams[0].is_default);
        assert_eq!(info.chapters[0].title.as_deref(), Some("Intro"));
    }

    #[test]
    fn parses_fractional_rates_without_rounding_them() {
        let rate = parse_frame_rate("30000/1001").expect("rate is valid");

        assert_eq!(rate.numerator, 30_000);
        assert_eq!(rate.denominator, 1_001);
        assert!(parse_frame_rate("0/0").is_none());
    }

    #[test]
    fn parses_seconds_into_integer_microseconds() {
        assert_eq!(parse_seconds_to_micros("1.25"), Some(1_250_000));
        assert_eq!(parse_seconds_to_micros("-0.125"), Some(-125_000));
        assert_eq!(parse_seconds_to_micros("N/A"), None);
    }

    #[test]
    fn rejects_metadata_without_a_video_stream() {
        let error = parse_probe_output(br#"{"streams": [], "format": {"duration": "1.0"}}"#)
            .expect_err("video is required");

        assert_eq!(error.code, "unsupported_media");
    }
}
