use std::{collections::HashSet, ffi::OsString, path::Path};

use serde::Deserialize;

use crate::{error::AppError, media::probe::MediaInfo};

const MICROS_PER_SECOND: f64 = 1_000_000.0;
const WEBCAM_SHORT_SIDE_RATIO: f64 = 0.24;

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

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CropSelection {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FastExportRequest {
    pub source_id: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    pub merge_audio: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackSelection {
    pub stream_index: u32,
    pub volume_percent: u16,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WebcamPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    TopLeftOffset,
    TopRightOffset,
    BottomLeftOffset,
    BottomRightOffset,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WebcamOverlaySelection {
    pub source_id: String,
    pub position: WebcamPosition,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizedExportRequest {
    pub source_id: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    pub merge_audio: bool,
    pub webcam: Option<WebcamOverlaySelection>,
    pub resolution: ResolutionSelection,
    pub crop: Option<CropSelection>,
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
        &request.audio_tracks,
    )?;

    let mut arguments = common_input_arguments(source_path, &request.trim);
    arguments.extend([
        OsString::from("-map"),
        OsString::from(format!("0:{}", source.video.stream_index)),
    ]);

    if request.audio_tracks.is_empty() {
        arguments.extend([
            OsString::from("-an"),
            OsString::from("-c:v"),
            OsString::from("copy"),
        ]);
    } else if request.merge_audio && request.audio_tracks.len() > 1 {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, true)),
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
    } else if audio_tracks_need_reencode(&request.audio_tracks) {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, false)),
            OsString::from("-c:v"),
            OsString::from("copy"),
            OsString::from("-c:a"),
            OsString::from("aac"),
            OsString::from("-b:a"),
            OsString::from("160k"),
        ]);
        for index in 0..request.audio_tracks.len() {
            arguments.extend([
                OsString::from("-map"),
                OsString::from(format!("[audio{index}]")),
            ]);
        }
    } else {
        for track in &request.audio_tracks {
            arguments.extend([
                OsString::from("-map"),
                OsString::from(format!("0:{}", track.stream_index)),
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
    webcam_source: Option<(&MediaInfo, &Path)>,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(
        source,
        &request.source_id,
        &request.trim,
        &request.audio_tracks,
    )?;
    validate_resolution(&request.resolution)?;
    validate_crop(request.crop.as_ref())?;
    if let Some(frame_rate) = &request.frame_rate
        && (frame_rate.numerator == 0 || frame_rate.denominator == 0)
    {
        return Err(AppError::invalid_request(
            "The output frame rate is invalid.",
        ));
    }

    let webcam_source = validate_webcam_request(request.webcam.as_ref(), webcam_source)?;
    let mut arguments = optimized_input_arguments(
        source_path,
        webcam_source.map(|(_, path)| path),
        &request.trim,
    );
    let video_filter = video_filter_graph(request);
    let mut filter_graphs = Vec::new();
    if let (Some(selection), Some((webcam_media, _))) = (request.webcam.as_ref(), webcam_source) {
        filter_graphs.push(webcam_filter_graph(
            source,
            webcam_media,
            selection,
            &video_filter,
            &request.resolution,
        ));
        arguments.extend([OsString::from("-map"), OsString::from("[vout]")]);
    } else {
        arguments.extend([
            OsString::from("-map"),
            OsString::from(format!("0:{}", source.video.stream_index)),
        ]);
    }
    if request.merge_audio && request.audio_tracks.len() > 1 {
        filter_graphs.push(audio_filter_graph(&request.audio_tracks, true));
        arguments.extend([
            OsString::from("-map"),
            OsString::from("[aout]"),
            OsString::from("-ac"),
            OsString::from("2"),
        ]);
    } else if audio_tracks_need_reencode(&request.audio_tracks) {
        filter_graphs.push(audio_filter_graph(&request.audio_tracks, false));
        for index in 0..request.audio_tracks.len() {
            arguments.extend([
                OsString::from("-map"),
                OsString::from(format!("[audio{index}]")),
            ]);
        }
    } else {
        for track in &request.audio_tracks {
            arguments.extend([
                OsString::from("-map"),
                OsString::from(format!("0:{}", track.stream_index)),
            ]);
        }
    }
    if request.audio_tracks.is_empty() {
        arguments.push(OsString::from("-an"));
    }
    if webcam_source.is_none() {
        arguments.extend([OsString::from("-vf"), OsString::from(video_filter)]);
    }
    if !filter_graphs.is_empty() {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(filter_graphs.join(";")),
        ]);
    }
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
        OsString::from("-y"),
        output_path.as_os_str().to_owned(),
    ]);
    Ok(arguments)
}

pub fn optimized_command_preview(
    source: &MediaInfo,
    webcam: Option<&MediaInfo>,
    request: &OptimizedExportRequest,
) -> Result<String, AppError> {
    let arguments = build_optimized_arguments(
        source,
        request,
        Path::new("<source>"),
        webcam.map(|media| (media, Path::new("<webcam>"))),
        Path::new("<output>"),
    )?;
    Ok(std::iter::once(OsString::from("ffmpeg"))
        .chain(arguments)
        .map(|argument| quote_preview_argument(&argument))
        .collect::<Vec<_>>()
        .join(" "))
}

fn optimized_input_arguments(
    source_path: &Path,
    webcam_path: Option<&Path>,
    trim: &TrimSelection,
) -> Vec<OsString> {
    let mut arguments = vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-progress"),
        OsString::from("pipe:1"),
        OsString::from("-ss"),
        OsString::from(format_seconds(trim.start_micros)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
    ];
    if let Some(webcam_path) = webcam_path {
        arguments.extend([
            OsString::from("-ss"),
            OsString::from(format_seconds(trim.start_micros)),
            OsString::from("-i"),
            webcam_path.as_os_str().to_owned(),
        ]);
    }
    arguments.extend([
        OsString::from("-t"),
        OsString::from(format_seconds(trim.end_micros - trim.start_micros)),
    ]);
    arguments
}

fn video_filter_graph(request: &OptimizedExportRequest) -> String {
    request
        .crop
        .as_ref()
        .map(|crop| {
            format!(
                "crop=iw*{}:ih*{}:iw*{}:ih*{},scale={}:{}",
                crop.width,
                crop.height,
                crop.x,
                crop.y,
                request.resolution.width,
                request.resolution.height
            )
        })
        .unwrap_or_else(|| {
            format!(
                "scale={}:{}",
                request.resolution.width, request.resolution.height
            )
        })
}

fn validate_webcam_request<'a>(
    selection: Option<&WebcamOverlaySelection>,
    source: Option<(&'a MediaInfo, &'a Path)>,
) -> Result<Option<(&'a MediaInfo, &'a Path)>, AppError> {
    match (selection, source) {
        (None, None) => Ok(None),
        (Some(selection), Some((media, path))) if selection.source_id == media.source_id => {
            Ok(Some((media, path)))
        }
        (Some(_), Some(_)) => Err(AppError::source_replaced()),
        _ => Err(AppError::invalid_request(
            "The webcam overlay source is unavailable.",
        )),
    }
}

fn webcam_filter_graph(
    source: &MediaInfo,
    webcam: &MediaInfo,
    selection: &WebcamOverlaySelection,
    main_filter: &str,
    resolution: &ResolutionSelection,
) -> String {
    let webcam_height = webcam_overlay_height(resolution);
    let (x, y) = match selection.position {
        WebcamPosition::TopLeft => ("0".to_owned(), "0".to_owned()),
        WebcamPosition::TopRight => ("W-w".to_owned(), "0".to_owned()),
        WebcamPosition::BottomLeft => ("0".to_owned(), "H-h".to_owned()),
        WebcamPosition::BottomRight => ("W-w".to_owned(), "H-h".to_owned()),
        WebcamPosition::TopLeftOffset => ("0".to_owned(), "H*0.08".to_owned()),
        WebcamPosition::TopRightOffset => ("W-w".to_owned(), "H*0.08".to_owned()),
        WebcamPosition::BottomLeftOffset => ("0".to_owned(), "H-h-H*0.08".to_owned()),
        WebcamPosition::BottomRightOffset => ("W-w".to_owned(), "H-h-H*0.08".to_owned()),
    };
    // Keep the selected resolution as an invariant of the labeled graph output,
    // rather than relying on the overlay filter to preserve its main input size.
    format!(
        "[0:{}]{main_filter},setpts=PTS-STARTPTS[main];[1:{}]scale=-2:{},setpts=PTS-STARTPTS[webcam];[main][webcam]overlay={x}:{y}:eof_action=pass:repeatlast=0[composited];[composited]scale={}:{},setsar=1[vout]",
        source.video.stream_index,
        webcam.video.stream_index,
        webcam_height,
        resolution.width,
        resolution.height,
    )
}

fn webcam_overlay_height(resolution: &ResolutionSelection) -> u32 {
    let short_side = resolution.width.min(resolution.height);
    (((f64::from(short_side) * WEBCAM_SHORT_SIDE_RATIO) / 2.0).round() as u32 * 2).max(2)
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
    audio_tracks: &[AudioTrackSelection],
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
    let mut selected_streams = HashSet::new();
    for track in audio_tracks {
        let is_known_stream = source
            .audio_streams
            .iter()
            .any(|stream| stream.stream_index == track.stream_index);
        if track.volume_percent == 0
            || track.volume_percent > 200
            || !is_known_stream
            || !selected_streams.insert(track.stream_index)
        {
            return Err(AppError::invalid_request(
                "An audio stream selection or volume is invalid.",
            ));
        }
    }
    Ok(())
}

fn validate_resolution(resolution: &ResolutionSelection) -> Result<(), AppError> {
    if resolution.width == 0 || resolution.height == 0 {
        return Err(AppError::invalid_request(
            "The output resolution must be greater than zero.",
        ));
    }
    Ok(())
}

fn validate_crop(crop: Option<&CropSelection>) -> Result<(), AppError> {
    if let Some(crop) = crop
        && (crop.x < 0.0
            || crop.y < 0.0
            || crop.width <= 0.0
            || crop.height <= 0.0
            || crop.x + crop.width > 1.0
            || crop.y + crop.height > 1.0)
    {
        return Err(AppError::invalid_request("The crop selection is invalid."));
    }
    Ok(())
}

fn audio_tracks_need_reencode(audio_tracks: &[AudioTrackSelection]) -> bool {
    audio_tracks.iter().any(|track| track.volume_percent != 50)
}

fn audio_filter_graph(audio_tracks: &[AudioTrackSelection], merge: bool) -> String {
    let mut graph = audio_tracks
        .iter()
        .enumerate()
        .map(|(index, track)| {
            format!(
                "[0:{}]volume={:.6}[audio{index}]",
                track.stream_index,
                f64::from(track.volume_percent) / 50.0
            )
        })
        .collect::<Vec<_>>();
    if merge {
        let inputs = (0..audio_tracks.len())
            .map(|index| format!("[audio{index}]"))
            .collect::<String>();
        graph.push(format!(
            "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=1[aout]",
            audio_tracks.len()
        ));
    }
    graph.join(";")
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
        "-filter_script",
        "-filter",
        "-vf",
        "-af",
        "-lavfi",
        "-r",
        "-fps_mode",
        "-s",
        "-aspect",
        "-ac",
        "-channel_layout",
        "-progress",
        "-y",
        "-n",
        "-f",
    ];
    const VALUELESS: &[&str] = &[
        "-benchmark",
        "-benchmark_all",
        "-bitexact",
        "-copyts",
        "-shortest",
        "-start_at_zero",
        "-stats",
        "-nostats",
    ];
    let mut expects_value = false;
    for argument in arguments {
        let value = argument.to_string_lossy();
        if value.starts_with('@') {
            return Err(invalid_optimized_arguments());
        }
        if expects_value {
            expects_value = false;
            continue;
        }
        if !value.starts_with('-') {
            return Err(invalid_optimized_arguments());
        }
        let (option, has_inline_value) = value
            .split_once('=')
            .map_or((value.as_ref(), false), |(option, _)| (option, true));
        let is_reserved = RESERVED.iter().any(|reserved| {
            option == *reserved
                || option
                    .strip_prefix(*reserved)
                    .is_some_and(|suffix| suffix.starts_with(':'))
        });
        if is_reserved {
            return Err(invalid_optimized_arguments());
        }
        if !has_inline_value && !VALUELESS.contains(&option) {
            expects_value = true;
        }
    }
    if expects_value {
        return Err(AppError::invalid_request(
            "The final optimized FFmpeg option is missing its value.",
        ));
    }
    Ok(())
}

fn invalid_optimized_arguments() -> AppError {
    AppError::invalid_request(
        "Optimized arguments cannot override input, trim, mapping, filters, output format, or output paths.",
    )
}

fn quote_preview_argument(argument: &OsString) -> String {
    let value = argument.to_string_lossy();
    if !value.is_empty()
        && !value
            .chars()
            .any(|character| character.is_whitespace() || matches!(character, '"' | '\\'))
    {
        return value.into_owned();
    }
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
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
        AudioTrackSelection, FastExportRequest, FrameRateSelection, OptimizedExportRequest,
        ResolutionSelection, TrimSelection, WebcamOverlaySelection, WebcamPosition,
        build_fast_arguments, build_optimized_arguments, optimized_command_preview,
        webcam_overlay_height,
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

    fn optimized_request(arguments: &str) -> OptimizedExportRequest {
        OptimizedExportRequest {
            source_id: "source-1".to_owned(),
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 2_000_000,
            },
            audio_tracks: vec![AudioTrackSelection {
                stream_index: 1,
                volume_percent: 50,
            }],
            merge_audio: false,
            webcam: None,
            resolution: ResolutionSelection {
                width: 1920,
                height: 1080,
            },
            crop: None,
            frame_rate: None,
            arguments: arguments.to_owned(),
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
                audio_tracks: vec![AudioTrackSelection {
                    stream_index: 2,
                    volume_percent: 50,
                }],
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
    fn fast_video_only_copy_does_not_reencode_video() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_id: "source-1".to_owned(),
                trim: TrimSelection {
                    start_micros: 1_000_000,
                    end_micros: 4_000_000,
                },
                audio_tracks: Vec::new(),
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
        assert!(values.contains(&"-an".to_owned()));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
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
                audio_tracks: vec![
                    AudioTrackSelection {
                        stream_index: 1,
                        volume_percent: 50,
                    },
                    AudioTrackSelection {
                        stream_index: 2,
                        volume_percent: 50,
                    },
                ],
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
    fn fast_volume_adjustment_filters_only_selected_audio() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_id: "source-1".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: vec![AudioTrackSelection {
                    stream_index: 2,
                    volume_percent: 100,
                }],
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
        assert!(
            values
                .iter()
                .any(|value| value.contains("0:2]volume=2.000000[audio0]"))
        );
        assert!(values.windows(2).any(|pair| pair == ["-map", "[audio0]"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(!values.iter().any(|value| value == "0:1"));
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
                audio_tracks: vec![AudioTrackSelection {
                    stream_index: 1,
                    volume_percent: 50,
                }],
                merge_audio: false,
                webcam: None,
                resolution: ResolutionSelection {
                    width: 1920,
                    height: 1080,
                },
                crop: None,
                frame_rate: Some(FrameRateSelection {
                    numerator: 30,
                    denominator: 1,
                }),
                arguments: "-c:v hevc_nvenc -cq 24".to_owned(),
            },
            Path::new("source.mkv"),
            None,
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
    fn optimized_audio_filter_does_not_bypass_video_scaling() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.resolution = ResolutionSelection {
            width: 2560,
            height: 1440,
        };
        request.audio_tracks[0].volume_percent = 100;

        let values = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            None,
            Path::new("out.mp4"),
        )
        .expect("filtered audio and scaled video are valid")
        .into_iter()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-vf", "scale=2560:1440"])
        );
        assert!(values.windows(2).any(|pair| {
            pair[0] == "-filter_complex" && pair[1].contains("volume=2.000000[audio0]")
        }));
        assert!(values.windows(2).any(|pair| pair == ["-map", "0:0"]));
        assert!(values.windows(2).any(|pair| pair == ["-map", "[audio0]"]));
    }

    #[test]
    fn optimized_arguments_cannot_override_application_owned_inputs_or_outputs() {
        let request = optimized_request("-c:v libx264 -i another.mp4");
        let error = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            None,
            Path::new("out.mp4"),
        )
        .expect_err("user input must not override the source");
        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn optimized_arguments_reject_filters_response_files_and_positional_outputs() {
        for arguments in [
            "-c:v libx264 -filter:v scale=640:360",
            "-c:v libx264 @preset.txt",
            "-c:v libx264 another-output.mp4",
            "-c:v",
        ] {
            let error = build_optimized_arguments(
                &media(),
                &optimized_request(arguments),
                Path::new("source.mkv"),
                None,
                Path::new("out.mp4"),
            )
            .expect_err("application-owned arguments and malformed options must fail");
            assert_eq!(error.code, "invalid_request", "arguments: {arguments}");
        }
    }

    #[test]
    fn optimized_export_supports_video_only_sources_and_preserves_source_timing() {
        let mut video_only = media();
        video_only.audio_streams.clear();
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.audio_tracks.clear();
        let values = build_optimized_arguments(
            &video_only,
            &request,
            Path::new("source.mkv"),
            None,
            Path::new("out.mp4"),
        )
        .expect("video-only request is valid")
        .into_iter()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

        assert!(values.contains(&"-an".to_owned()));
        assert!(!values.contains(&"-r".to_owned()));
    }

    #[test]
    fn export_rejects_duplicate_audio_stream_selections() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.audio_tracks.push(request.audio_tracks[0].clone());
        let error = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            None,
            Path::new("out.mp4"),
        )
        .expect_err("a stream can only be selected once");

        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn optimized_preview_is_assembled_by_native_code_without_private_paths() {
        let preview = optimized_command_preview(
            &media(),
            None,
            &optimized_request("-c:v libx264 -metadata title=\"My clip\""),
        )
        .expect("preview request is valid");

        assert!(preview.starts_with("ffmpeg -hide_banner -nostdin"));
        assert!(preview.contains("-i <source>"));
        assert!(preview.ends_with("-y <output>"));
        assert!(preview.contains("\"title=My clip\""));
    }

    #[test]
    fn argument_arrays_preserve_unicode_spaces_and_long_paths() {
        let long_component = "x".repeat(240);
        let source_path = std::path::PathBuf::from(format!(
            "C:/Videos/Clips with spaces/🎬-{long_component}.mkv"
        ));
        let output_path = std::path::PathBuf::from("C:/Exports/結果 clip.mp4");
        let arguments = build_optimized_arguments(
            &media(),
            &optimized_request("-c:v libx264 -crf 20"),
            &source_path,
            None,
            &output_path,
        )
        .expect("paths are passed as opaque arguments");

        assert!(
            arguments
                .iter()
                .any(|value| value == source_path.as_os_str())
        );
        assert!(
            arguments
                .iter()
                .any(|value| value == output_path.as_os_str())
        );
    }

    #[test]
    fn custom_resolution_dimensions_are_accepted() {
        let mut rotated = media();
        rotated.video.width = 1080;
        rotated.video.height = 1920;
        rotated.video.rotation_degrees = Some(90);
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.resolution = ResolutionSelection {
            width: 1920,
            height: 1080,
        };

        assert!(
            build_optimized_arguments(
                &rotated,
                &request,
                Path::new("source.mp4"),
                None,
                Path::new("out.mp4"),
            )
            .is_ok()
        );
    }

    #[test]
    fn optimized_webcam_overlay_preserves_the_requested_output_resolution() {
        let mut webcam = media();
        webcam.source_id = "webcam-2".to_owned();
        webcam.video.stream_index = 3;
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.resolution = ResolutionSelection {
            width: 2560,
            height: 1440,
        };
        request.webcam = Some(WebcamOverlaySelection {
            source_id: webcam.source_id.clone(),
            position: WebcamPosition::BottomRight,
        });

        let values = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Some((&webcam, Path::new("webcam.mkv"))),
            Path::new("out.mp4"),
        )
        .expect("webcam overlay request is valid")
        .into_iter()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

        assert_eq!(
            values.iter().filter(|value| value.as_str() == "-i").count(),
            2
        );
        assert!(values.windows(2).any(|pair| pair == ["-map", "[vout]"]));
        assert!(values.iter().any(|value| {
            value.contains("[0:0]scale=2560:1440")
                && value.contains("[1:3]scale=-2:346")
                && value.contains(
                    "overlay=W-w:H-h:eof_action=pass:repeatlast=0[composited];[composited]scale=2560:1440,setsar=1[vout]",
                )
        }));
        assert!(!values.iter().any(|value| value == "1:1"));
    }

    #[test]
    fn webcam_height_uses_the_shorter_cropped_output_side() {
        assert_eq!(
            webcam_overlay_height(&ResolutionSelection {
                width: 2560,
                height: 1440,
            }),
            346
        );
        assert_eq!(
            webcam_overlay_height(&ResolutionSelection {
                width: 720,
                height: 1280,
            }),
            172
        );
    }

    #[test]
    fn optimized_offset_webcam_overlays_keep_the_horizontal_edge_flush() {
        let mut webcam = media();
        webcam.source_id = "webcam-2".to_owned();
        webcam.video.stream_index = 3;
        for (position, coordinates) in [
            (WebcamPosition::TopLeftOffset, "0:H*0.08"),
            (WebcamPosition::TopRightOffset, "W-w:H*0.08"),
            (WebcamPosition::BottomLeftOffset, "0:H-h-H*0.08"),
            (WebcamPosition::BottomRightOffset, "W-w:H-h-H*0.08"),
        ] {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.webcam = Some(WebcamOverlaySelection {
                source_id: webcam.source_id.clone(),
                position,
            });

            let values = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Some((&webcam, Path::new("webcam.mkv"))),
                Path::new("out.mp4"),
            )
            .expect("offset webcam overlay request is valid");
            let expected = format!(
                "overlay={coordinates}:eof_action=pass:repeatlast=0[composited];[composited]scale=1920:1080,setsar=1[vout]"
            );

            assert!(
                values
                    .iter()
                    .any(|value| value.to_string_lossy().contains(&expected))
            );
        }
    }
}
