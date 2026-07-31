use std::{ffi::OsString, path::Path};

use serde::Deserialize;

use crate::{error::AppError, media::probe::MediaInfo};

const MICROS_PER_SECOND: f64 = 1_000_000.0;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrimSelection {
    pub start_micros: i64,
    pub end_micros: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FrameRateSelection {
    pub numerator: u64,
    pub denominator: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResolutionSelection {
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FastExportRequest {
    pub source_id: String,
    pub trim: TrimSelection,
    pub audio_stream_indexes: Vec<u32>,
    pub merge_audio: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizedExportRequest {
    pub source_id: String,
    pub trim: TrimSelection,
    pub audio_stream_indexes: Vec<u32>,
    pub merge_audio: bool,
    pub resolution: ResolutionSelection,
    pub frame_rate: Option<FrameRateSelection>,
    pub arguments: String,
}

pub fn build_fast_arguments(
    source: &MediaInfo,
    request: &FastExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(
        source,
        &request.source_id,
        &request.trim,
        &request.audio_stream_indexes,
    )?;

    let mut arguments = common_input_arguments(source_path, &request.trim);
    arguments.extend([
        OsString::from("-map"),
        OsString::from(format!("0:{}", source.video.stream_index)),
    ]);

    if request.audio_stream_indexes.is_empty() {
        arguments.push(OsString::from("-an"));
    } else if request.merge_audio && request.audio_stream_indexes.len() > 1 {
        let audio_inputs = request
            .audio_stream_indexes
            .iter()
            .map(|stream_index| format!("[0:{stream_index}]"))
            .collect::<String>();
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(format!(
                "{audio_inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=1[aout]",
                request.audio_stream_indexes.len()
            )),
            OsString::from("-map"),
            OsString::from("[aout]"),
            OsString::from("-c:v"),
            OsString::from("copy"),
            OsString::from("-c:a"),
            OsString::from("aac"),
            OsString::from("-b:a"),
            OsString::from("160k"),
            OsString::from("-ac"),
            OsString::from("2"),
        ]);
    } else {
        for stream_index in &request.audio_stream_indexes {
            arguments.extend([
                OsString::from("-map"),
                OsString::from(format!("0:{stream_index}")),
            ]);
        }
        arguments.extend([OsString::from("-c"), OsString::from("copy")]);
    }

    arguments.extend([
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-avoid_negative_ts"),
        OsString::from("make_zero"),
        OsString::from("-movflags"),
        OsString::from("+faststart"),
        OsString::from("-y"),
        output_path.as_os_str().to_owned(),
    ]);
    Ok(arguments)
}

pub fn build_optimized_arguments(
    source: &MediaInfo,
    request: &OptimizedExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(
        source,
        &request.source_id,
        &request.trim,
        &request.audio_stream_indexes,
    )?;
    if request.resolution.width == 0 || request.resolution.height == 0 {
        return Err(AppError::invalid_request(
            "The output resolution is invalid.",
        ));
    }
    if let Some(frame_rate) = &request.frame_rate {
        if frame_rate.numerator == 0 || frame_rate.denominator == 0 {
            return Err(AppError::invalid_request(
                "The output frame rate is invalid.",
            ));
        }
    }

    let mut arguments = common_input_arguments(source_path, &request.trim);
    arguments.extend([
        OsString::from("-map"),
        OsString::from(format!("0:{}", source.video.stream_index)),
    ]);
    if request.merge_audio && request.audio_stream_indexes.len() > 1 {
        let audio_inputs = request
            .audio_stream_indexes
            .iter()
            .map(|stream_index| format!("[0:{stream_index}]"))
            .collect::<String>();
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(format!(
                "{audio_inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=1[aout]",
                request.audio_stream_indexes.len()
            )),
            OsString::from("-map"),
            OsString::from("[aout]"),
        ]);
    } else {
        for stream_index in &request.audio_stream_indexes {
            arguments.extend([
                OsString::from("-map"),
                OsString::from(format!("0:{stream_index}")),
            ]);
        }
    }
    if request.audio_stream_indexes.is_empty() {
        arguments.push(OsString::from("-an"));
    }
    arguments.extend([
        OsString::from("-vf"),
        OsString::from(format!(
            "scale={}:{}",
            request.resolution.width, request.resolution.height
        )),
    ]);
    if let Some(frame_rate) = &request.frame_rate {
        arguments.extend([
            OsString::from("-r"),
            OsString::from(format!(
                "{}/{}",
                frame_rate.numerator, frame_rate.denominator
            )),
        ]);
    }
    let user_arguments = parse_arguments(&request.arguments)?;
    validate_user_arguments(&user_arguments)?;
    arguments.extend(user_arguments);
    arguments.extend([
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-movflags"),
        OsString::from("+faststart"),
        OsString::from("-y"),
        output_path.as_os_str().to_owned(),
    ]);
    Ok(arguments)
}

fn common_input_arguments(source_path: &Path, trim: &TrimSelection) -> Vec<OsString> {
    let duration = (trim.end_micros - trim.start_micros) as f64 / MICROS_PER_SECOND;
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-progress"),
        OsString::from("pipe:1"),
        OsString::from("-ss"),
        OsString::from(format_seconds(trim.start_micros)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-t"),
        OsString::from(format_seconds_f64(duration)),
    ]
}

fn validate_common_request(
    source: &MediaInfo,
    source_id: &str,
    trim: &TrimSelection,
    audio_stream_indexes: &[u32],
) -> Result<(), AppError> {
    if source.source_id != source_id {
        return Err(AppError::source_replaced());
    }
    if trim.start_micros < 0
        || trim.end_micros <= trim.start_micros
        || trim.end_micros > source.duration_micros
    {
        return Err(AppError::invalid_request(
            "The selected export range is invalid.",
        ));
    }
    if audio_stream_indexes.iter().any(|index| {
        !source
            .audio_streams
            .iter()
            .any(|stream| stream.stream_index == *index)
    }) {
        return Err(AppError::invalid_request(
            "An audio stream selection is invalid.",
        ));
    }
    Ok(())
}

fn parse_arguments(value: &str) -> Result<Vec<OsString>, AppError> {
    let mut arguments = Vec::new();
    let mut current = String::new();
    let mut quote = None;
    for character in value.chars() {
        match (quote, character) {
            (Some(active), value) if value == active => quote = None,
            (None, '\'' | '"') => quote = Some(character),
            (None, value) if value.is_whitespace() => {
                if !current.is_empty() {
                    arguments.push(OsString::from(std::mem::take(&mut current)));
                }
            }
            (_, value) => current.push(value),
        }
    }
    if quote.is_some() {
        return Err(AppError::invalid_request(
            "The optimized FFmpeg arguments contain an unclosed quote.",
        ));
    }
    if !current.is_empty() {
        arguments.push(OsString::from(current));
    }
    Ok(arguments)
}

fn validate_user_arguments(arguments: &[OsString]) -> Result<(), AppError> {
    const RESERVED: &[&str] = &[
        "-i",
        "-ss",
        "-sseof",
        "-t",
        "-to",
        "-map",
        "-map_channel",
        "-filter_complex",
        "-filter_complex_script",
        "-vf",
        "-progress",
        "-y",
        "-n",
        "-f",
    ];
    if arguments.iter().any(|argument| {
        let value = argument.to_string_lossy();
        value.starts_with('@') || RESERVED.iter().any(|reserved| *reserved == value)
    }) {
        return Err(AppError::invalid_request(
            "Optimized arguments cannot override input, trim, mapping, filter, or output options.",
        ));
    }
    Ok(())
}

fn format_seconds(micros: i64) -> String {
    format_seconds_f64(micros as f64 / MICROS_PER_SECOND)
}

fn format_seconds_f64(seconds: f64) -> String {
    format!("{seconds:.6}")
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        FastExportRequest, FrameRateSelection, OptimizedExportRequest, ResolutionSelection,
        TrimSelection, build_fast_arguments, build_optimized_arguments,
    };
    use crate::media::probe::{AudioStream, MediaInfo, VideoStream};

    fn media() -> MediaInfo {
        MediaInfo {
            source_id: "source-1".to_owned(),
            format_name: "matroska".to_owned(),
            format_long_name: None,
            duration_micros: 10_000_000,
            start_time_micros: Some(0),
            size_bytes: None,
            bitrate: None,
            video: VideoStream {
                stream_index: 0,
                codec_name: "h264".to_owned(),
                width: 3840,
                height: 2160,
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
                rotation_degrees: None,
            },
            audio_streams: vec![
                AudioStream {
                    stream_index: 1,
                    codec_name: "aac".to_owned(),
                    channels: Some(2),
                    channel_layout: Some("stereo".to_owned()),
                    sample_rate_hz: Some(48_000),
                    language: None,
                    title: None,
                    is_default: true,
                },
                AudioStream {
                    stream_index: 2,
                    codec_name: "aac".to_owned(),
                    channels: Some(2),
                    channel_layout: Some("stereo".to_owned()),
                    sample_rate_hz: Some(48_000),
                    language: None,
                    title: None,
                    is_default: false,
                },
            ],
            chapters: Vec::new(),
        }
    }

    #[test]
    fn fast_copy_maps_only_selected_streams() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_id: "source-1".to_owned(),
                trim: TrimSelection {
                    start_micros: 1_000_000,
                    end_micros: 4_000_000,
                },
                audio_stream_indexes: vec![2],
                merge_audio: false,
            },
            Path::new("source.mkv"),
            Path::new("out.mkv"),
        )
        .expect("request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(values.windows(2).any(|pair| pair == ["-map", "0:0"]));
        assert!(values.windows(2).any(|pair| pair == ["-map", "0:2"]));
        assert!(values.contains(&"-c".to_owned()));
        assert!(!values.contains(&"0:1".to_owned()));
    }

    #[test]
    fn fast_merge_reencodes_only_the_merged_audio() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_id: "source-1".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_stream_indexes: vec![1, 2],
                merge_audio: true,
            },
            Path::new("source.mkv"),
            Path::new("out.mkv"),
        )
        .expect("request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(values.iter().any(|value| {
            value.contains("amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[aout]")
        }));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
    }

    #[test]
    fn optimized_route_owns_trim_and_scale_while_accepting_codec_arguments() {
        let args = build_optimized_arguments(
            &media(),
            &OptimizedExportRequest {
                source_id: "source-1".to_owned(),
                trim: TrimSelection {
                    start_micros: 2_000_000,
                    end_micros: 7_000_000,
                },
                audio_stream_indexes: vec![1],
                merge_audio: false,
                resolution: ResolutionSelection {
                    width: 1920,
                    height: 1080,
                },
                frame_rate: Some(FrameRateSelection {
                    numerator: 30,
                    denominator: 1,
                }),
                arguments: "-c:v hevc_nvenc -cq 24".to_owned(),
            },
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(values.windows(2).any(|pair| pair == ["-ss", "2.000000"]));
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-vf", "scale=1920:1080"])
        );
        assert!(values.windows(2).any(|pair| pair == ["-r", "30/1"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "hevc_nvenc"]));
    }

    #[test]
    fn optimized_arguments_cannot_override_application_owned_inputs_or_outputs() {
        let request = OptimizedExportRequest {
            source_id: "source-1".to_owned(),
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 2_000_000,
            },
            audio_stream_indexes: vec![1],
            merge_audio: false,
            resolution: ResolutionSelection {
                width: 1920,
                height: 1080,
            },
            frame_rate: None,
            arguments: "-c:v libx264 -i another.mp4".to_owned(),
        };
        let error = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect_err("user input must not override the source");
        assert_eq!(error.code, "invalid_request");
    }
}
