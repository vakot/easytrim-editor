use std::{collections::HashSet, ffi::OsString, path::Path};

use serde::{Deserialize, Serialize};

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

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CropSelection {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FastExportRequest {
    pub source_path: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    pub merge_audio: bool,
    pub rotation_degrees: u16,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackSelection {
    pub stream_index: u32,
    pub processing: AudioTrackProcessing,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackProcessing {
    pub gain_db: f64,
    #[serde(default)]
    pub loudness_normalization: Option<LoudnessNormalization>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct AudioTrackCacheKey {
    pub stream_index: u32,
    gain_db_bits: u64,
    pub loudness_normalization: Option<LoudnessNormalizationCacheKey>,
}

impl From<&AudioTrackSelection> for AudioTrackCacheKey {
    fn from(track: &AudioTrackSelection) -> Self {
        Self {
            stream_index: track.stream_index,
            gain_db_bits: if track.processing.gain_db == 0.0 {
                0.0_f64.to_bits()
            } else {
                track.processing.gain_db.to_bits()
            },
            loudness_normalization: track
                .processing
                .loudness_normalization
                .as_ref()
                .map(LoudnessNormalizationCacheKey::from),
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizedExportRequest {
    pub source_path: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    pub merge_audio: bool,
    pub rotation_degrees: u16,
    pub resolution: ResolutionSelection,
    pub crop: Option<CropSelection>,
    #[serde(default)]
    pub flip_horizontal: bool,
    #[serde(default)]
    pub flip_vertical: bool,
    pub frame_rate: Option<FrameRateSelection>,
    pub arguments: String,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Hash, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LoudnessPreset {
    WebVideo,
    Streaming,
    Broadcast,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(untagged)]
pub enum LoudnessNormalization {
    Preset(LoudnessPreset),
    Custom(CustomLoudnessNormalization),
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLoudnessNormalization {
    pub mode: CustomLoudnessMode,
    pub target_lufs: f64,
    pub max_true_peak_db: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CustomLoudnessMode {
    Custom,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum LoudnessNormalizationCacheKey {
    Preset(LoudnessPreset),
    Custom {
        target_lufs_bits: u64,
        max_true_peak_db_bits: u64,
    },
}

impl From<&LoudnessNormalization> for LoudnessNormalizationCacheKey {
    fn from(normalization: &LoudnessNormalization) -> Self {
        match normalization {
            LoudnessNormalization::Preset(preset) => Self::Preset(*preset),
            LoudnessNormalization::Custom(settings) => Self::Custom {
                target_lufs_bits: settings.target_lufs.to_bits(),
                max_true_peak_db_bits: settings.max_true_peak_db.to_bits(),
            },
        }
    }
}

impl LoudnessPreset {
    pub(crate) fn targets(self) -> (f64, f64) {
        match self {
            Self::WebVideo => (-14.0, -1.0),
            Self::Streaming => (-16.0, -1.5),
            Self::Broadcast => (-23.0, -2.0),
        }
    }
}

impl LoudnessNormalization {
    pub(crate) fn targets(&self) -> (f64, f64) {
        match self {
            Self::Preset(preset) => preset.targets(),
            Self::Custom(settings) => (settings.target_lufs, settings.max_true_peak_db),
        }
    }
}

pub fn build_fast_arguments(
    source: &MediaInfo,
    request: &FastExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    validate_rotation(request.rotation_degrees)?;
    if request.rotation_degrees != 0 {
        return Err(AppError::invalid_request(
            "Fast cut cannot apply rotation; use optimized render.",
        ));
    }

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
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    validate_resolution(&request.resolution)?;
    validate_crop(request.crop.as_ref())?;
    validate_rotation(request.rotation_degrees)?;
    if let Some(frame_rate) = &request.frame_rate
        && (frame_rate.numerator == 0 || frame_rate.denominator == 0)
    {
        return Err(AppError::invalid_request(
            "The output frame rate is invalid.",
        ));
    }

    let mut arguments = common_input_arguments(source_path, &request.trim);
    arguments.extend([
        OsString::from("-map"),
        OsString::from(format!("0:{}", source.video.stream_index)),
    ]);
    if request.merge_audio && request.audio_tracks.len() > 1 {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, true)),
            OsString::from("-map"),
            OsString::from("[aout]"),
            OsString::from("-ac"),
            OsString::from("2"),
        ]);
    } else if audio_tracks_need_reencode(&request.audio_tracks) {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, false)),
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
    }
    if request.audio_tracks.is_empty() {
        arguments.push(OsString::from("-an"));
    }
    let (rotation_degrees, flip_horizontal, flip_vertical, crop) = effective_transform(request);
    let mut video_filters = Vec::new();
    if rotation_degrees != 0 {
        video_filters.push(rotation_filter(rotation_degrees));
    }
    if let Some(crop) = crop.as_ref() {
        video_filters.push(format!(
            "crop=iw*{}:ih*{}:iw*{}:ih*{}",
            crop.width, crop.height, crop.x, crop.y
        ));
    }
    if flip_horizontal {
        video_filters.push("hflip".to_owned());
    }
    if flip_vertical {
        video_filters.push("vflip".to_owned());
    }
    video_filters.push(format!(
        "scale={}:{},setsar=1",
        request.resolution.width, request.resolution.height,
    ));
    let video_filter = video_filters.join(",");
    arguments.extend([OsString::from("-vf"), OsString::from(video_filter)]);
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
    request: &OptimizedExportRequest,
) -> Result<String, AppError> {
    let arguments = build_optimized_arguments(
        source,
        request,
        Path::new("<source>"),
        Path::new("<output>"),
    )?;
    Ok(std::iter::once(OsString::from("ffmpeg"))
        .chain(arguments)
        .map(|argument| quote_preview_argument(&argument))
        .collect::<Vec<_>>()
        .join(" "))
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

pub(crate) fn validate_common_request(
    source: &MediaInfo,
    trim: &TrimSelection,
    audio_tracks: &[AudioTrackSelection],
) -> Result<(), AppError> {
    if trim.start_micros < 0
        || trim.end_micros <= trim.start_micros
        || trim.end_micros > source.duration_micros
    {
        return Err(AppError::invalid_request(
            "The selected export range is invalid.",
        ));
    }
    validate_audio_track_selections(source, audio_tracks)
}

pub(crate) fn validate_audio_track_selections(
    source: &MediaInfo,
    audio_tracks: &[AudioTrackSelection],
) -> Result<(), AppError> {
    let mut selected_streams = HashSet::new();
    for track in audio_tracks {
        let is_known_stream = source
            .audio_streams
            .iter()
            .any(|stream| stream.stream_index == track.stream_index);
        if !track.processing.gain_db.is_finite()
            || !is_known_stream
            || !selected_streams.insert(track.stream_index)
            || !is_valid_loudness_normalization(track.processing.loudness_normalization.as_ref())
        {
            return Err(AppError::invalid_request(
                "An audio stream selection or processing setting is invalid.",
            ));
        }
    }
    Ok(())
}

fn is_valid_loudness_normalization(normalization: Option<&LoudnessNormalization>) -> bool {
    match normalization {
        Some(LoudnessNormalization::Custom(settings)) => {
            settings.target_lufs.is_finite()
                && (-36.0..=-5.0).contains(&settings.target_lufs)
                && settings.max_true_peak_db.is_finite()
                && (-9.0..=0.0).contains(&settings.max_true_peak_db)
        }
        Some(LoudnessNormalization::Preset(_)) | None => true,
    }
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

fn validate_rotation(rotation_degrees: u16) -> Result<(), AppError> {
    if matches!(rotation_degrees, 0 | 90 | 180 | 270) {
        Ok(())
    } else {
        Err(AppError::invalid_request(
            "The rotation must be 0, 90, 180, or 270 degrees.",
        ))
    }
}

fn rotation_filter(rotation_degrees: u16) -> String {
    match rotation_degrees {
        90 => "transpose=1".to_owned(),
        180 => "hflip,vflip".to_owned(),
        270 => "transpose=2".to_owned(),
        _ => String::new(),
    }
}

fn effective_transform(
    request: &OptimizedExportRequest,
) -> (u16, bool, bool, Option<CropSelection>) {
    if request.rotation_degrees != 180 || !request.flip_horizontal || !request.flip_vertical {
        return (
            request.rotation_degrees,
            request.flip_horizontal,
            request.flip_vertical,
            request.crop.clone(),
        );
    }

    (
        0,
        false,
        false,
        request.crop.as_ref().map(|crop| CropSelection {
            x: 1.0 - crop.x - crop.width,
            y: 1.0 - crop.y - crop.height,
            width: crop.width,
            height: crop.height,
        }),
    )
}

fn audio_tracks_need_reencode(audio_tracks: &[AudioTrackSelection]) -> bool {
    audio_tracks.iter().any(|track| {
        track.processing.gain_db != 0.0 || track.processing.loudness_normalization.is_some()
    })
}

pub(crate) fn audio_filter_graph(audio_tracks: &[AudioTrackSelection], merge: bool) -> String {
    // Process each track in canonical order: optional normalization, then final manual gain.
    let mut graph = audio_tracks
        .iter()
        .enumerate()
        .map(|(index, track)| {
            let (integrated_lufs, true_peak_db) = track
                .processing
                .loudness_normalization
                .as_ref()
                .map(LoudnessNormalization::targets)
                .unwrap_or((0.0, 0.0));
            let mut filters = format!("[0:{}]", track.stream_index);
            if track.processing.loudness_normalization.is_some() {
                filters.push_str(&format!(
                    "loudnorm=I={integrated_lufs}:TP={true_peak_db}:LRA=11[track{index}_normalized]"
                ));
            } else {
                filters.push_str(&format!("anull[track{index}_normalized]"));
            }
            filters.push_str(&format!(
                ";[track{index}_normalized]volume={:.6}dB[audio{index}]",
                track.processing.gain_db
            ));
            filters
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
        AudioTrackProcessing, AudioTrackSelection, CropSelection, FastExportRequest,
        FrameRateSelection, LoudnessNormalization, LoudnessPreset, OptimizedExportRequest,
        ResolutionSelection, TrimSelection, build_fast_arguments, build_optimized_arguments,
        optimized_command_preview,
    };
    use crate::media::probe::{AudioStream, MediaInfo, VideoStream};

    fn media() -> MediaInfo {
        MediaInfo {
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
            source_path: "source.mkv".to_owned(),
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 2_000_000,
            },
            audio_tracks: vec![AudioTrackSelection {
                stream_index: 1,
                processing: AudioTrackProcessing {
                    gain_db: 0.0,
                    loudness_normalization: None,
                },
            }],
            merge_audio: false,
            rotation_degrees: 0,
            resolution: ResolutionSelection {
                width: 1920,
                height: 1080,
            },
            crop: None,
            flip_horizontal: false,
            flip_vertical: false,
            frame_rate: None,
            arguments: arguments.to_owned(),
        }
    }

    #[test]
    fn fast_copy_maps_only_selected_streams() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 1_000_000,
                    end_micros: 4_000_000,
                },
                audio_tracks: vec![AudioTrackSelection {
                    stream_index: 2,
                    processing: AudioTrackProcessing {
                        gain_db: 0.0,
                        loudness_normalization: None,
                    },
                }],
                merge_audio: false,
                rotation_degrees: 0,
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
        assert!(values.windows(2).any(|pair| pair == ["-c", "copy"]));
        assert!(!values.contains(&"-filter_complex".to_owned()));
        assert!(!values.contains(&"0:1".to_owned()));
    }

    #[test]
    fn fast_video_only_copy_does_not_reencode_video() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 1_000_000,
                    end_micros: 4_000_000,
                },
                audio_tracks: Vec::new(),
                merge_audio: false,
                rotation_degrees: 0,
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
    fn fast_cut_rejects_rotation_instead_of_copying_untransformed_video() {
        let error = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: Vec::new(),
                merge_audio: false,
                rotation_degrees: 90,
            },
            Path::new("source.mkv"),
            Path::new("out.mkv"),
        )
        .expect_err("fast cut must not silently drop rotation");

        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn fast_merge_reencodes_only_the_merged_audio() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: vec![
                    AudioTrackSelection {
                        stream_index: 1,
                        processing: AudioTrackProcessing {
                            gain_db: 0.0,
                            loudness_normalization: None,
                        },
                    },
                    AudioTrackSelection {
                        stream_index: 2,
                        processing: AudioTrackProcessing {
                            gain_db: 0.0,
                            loudness_normalization: None,
                        },
                    },
                ],
                merge_audio: true,
                rotation_degrees: 0,
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
    fn fast_gain_processing_filters_only_selected_audio() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: vec![AudioTrackSelection {
                    stream_index: 2,
                    processing: AudioTrackProcessing {
                        gain_db: 6.0,
                        loudness_normalization: None,
                    },
                }],
                merge_audio: false,
                rotation_degrees: 0,
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
                .any(|value| value.contains("0:2]anull[track0_normalized]"))
        );
        assert!(
            values
                .iter()
                .any(|value| value.contains("[track0_normalized]volume=6.000000dB[audio0]"))
        );
        assert!(values.windows(2).any(|pair| pair == ["-map", "[audio0]"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(!values.iter().any(|value| value == "0:1"));
    }

    #[test]
    fn optimized_export_normalizes_each_track_before_final_gain() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.merge_audio = false;
        request.audio_tracks.push(AudioTrackSelection {
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: -3.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Streaming,
                )),
            },
        });

        let args = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        let graph_index = values
            .iter()
            .position(|value| value == "-filter_complex")
            .unwrap();
        let graph = &values[graph_index + 1];

        assert!(graph.contains(
            "[0:1]anull[track0_normalized];[track0_normalized]volume=0.000000dB[audio0]"
        ));
        assert!(graph.contains("[0:2]loudnorm=I=-16:TP=-1.5:LRA=11[track1_normalized];[track1_normalized]volume=-3.000000dB[audio1]"));
        assert!(values.contains(&"[audio0]".to_owned()));
        assert!(values.contains(&"[audio1]".to_owned()));
    }

    #[test]
    fn optimized_route_owns_trim_and_scale_while_accepting_codec_arguments() {
        let args = build_optimized_arguments(
            &media(),
            &OptimizedExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 2_000_000,
                    end_micros: 7_000_000,
                },
                audio_tracks: vec![AudioTrackSelection {
                    stream_index: 1,
                    processing: AudioTrackProcessing {
                        gain_db: 0.0,
                        loudness_normalization: None,
                    },
                }],
                merge_audio: false,
                rotation_degrees: 0,
                resolution: ResolutionSelection {
                    width: 1920,
                    height: 1080,
                },
                crop: None,
                flip_horizontal: false,
                flip_vertical: false,
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
                .any(|pair| pair == ["-vf", "scale=1920:1080,setsar=1"])
        );
        assert!(values.windows(2).any(|pair| pair == ["-r", "30/1"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "hevc_nvenc"]));
    }

    #[test]
    fn optimized_route_uses_the_four_supported_rotation_filters() {
        for (rotation, filter) in [
            (0, ""),
            (90, "transpose=1,"),
            (180, "hflip,vflip,"),
            (270, "transpose=2,"),
        ] {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.rotation_degrees = rotation;
            let values = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect("rotation request is valid")
            .into_iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

            let expected_filter = format!("{filter}scale=1920:1080,setsar=1");
            assert!(
                values
                    .windows(2)
                    .any(|pair| { pair[0] == "-vf" && pair[1] == expected_filter })
            );
        }
    }

    #[test]
    fn optimized_route_appends_requested_flip_filters_after_crop() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.crop = Some(CropSelection {
            x: 0.1,
            y: 0.2,
            width: 0.5,
            height: 0.6,
        });
        request.flip_horizontal = true;
        request.flip_vertical = true;

        let values = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("flip request is valid")
        .into_iter()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

        assert!(values.windows(2).any(|pair| {
            pair == [
                "-vf",
                "crop=iw*0.5:ih*0.6:iw*0.1:ih*0.2,hflip,vflip,scale=1920:1080,setsar=1",
            ]
        }));
    }

    #[test]
    fn optimized_route_normalizes_an_identity_transform_before_building_filters() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.crop = Some(CropSelection {
            x: 0.1,
            y: 0.2,
            width: 0.5,
            height: 0.6,
        });
        request.rotation_degrees = 180;
        request.flip_horizontal = true;
        request.flip_vertical = true;

        let values = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("identity transform is valid")
        .into_iter()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

        let video_filter = values
            .windows(2)
            .find_map(|pair| (pair[0] == "-vf").then_some(pair[1].as_str()))
            .expect("optimized request includes a video filter");
        assert!(video_filter.starts_with("crop=iw*0.5:ih*0.6:iw*0.4:ih*0.2"));
        assert!(video_filter.ends_with(",scale=1920:1080,setsar=1"));
        assert!(!video_filter.contains("hflip"));
        assert!(!video_filter.contains("vflip"));
    }

    #[test]
    fn optimized_arguments_cannot_override_application_owned_inputs_or_outputs() {
        let request = optimized_request("-c:v libx264 -i another.mp4");
        let error = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
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
            Path::new("out.mp4"),
        )
        .expect_err("a stream can only be selected once");

        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn export_rejects_non_finite_track_gain() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.audio_tracks[0].processing.gain_db = f64::NAN;
        let error = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect_err("non-finite values cannot become FFmpeg filter arguments");

        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn fast_cut_reencodes_when_only_track_normalization_is_enabled() {
        let track = AudioTrackSelection {
            stream_index: 1,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::WebVideo,
                )),
            },
        };
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: vec![track.clone()],
                merge_audio: false,
                rotation_degrees: 0,
            },
            Path::new("source.mkv"),
            Path::new("out.mkv"),
        )
        .expect("normalization is a valid processing setting");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(
            values
                .iter()
                .any(|value| value.contains("loudnorm=I=-14:TP=-1:LRA=11"))
        );
    }

    #[test]
    fn optimized_preview_is_assembled_by_native_code_without_private_paths() {
        let preview = optimized_command_preview(
            &media(),
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
                Path::new("out.mp4"),
            )
            .is_ok()
        );
    }

    #[test]
    fn custom_scaling_resets_sample_aspect_ratio_after_shrinking_wide_video() {
        let mut wide = media();
        wide.video.width = 5120;
        wide.video.height = 1440;
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.resolution = ResolutionSelection {
            width: 2560,
            height: 1440,
        };

        let values = build_optimized_arguments(
            &wide,
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("wide custom scaling request is valid")
        .into_iter()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-vf", "scale=2560:1440,setsar=1"])
        );
    }
}
