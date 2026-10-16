use std::{
    collections::HashSet,
    ffi::OsString,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use serde::Deserialize;

use crate::{
    error::{AppError, AppErrorMessageId},
    media::{
        audio_filters::{
            compiler::compile_chain,
            model::{AudioTrackSelection, validate_track_volume},
        },
        probe::MediaInfo,
    },
};

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
    #[serde(default)]
    pub audio_metadata: Vec<AudioTrackMetadataSelection>,
    pub merge_audio: bool,
    #[serde(default)]
    pub chapters: Option<Vec<ExportChapter>>,
    #[serde(default)]
    pub strip_metadata: bool,
    pub rotation_degrees: u16,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportChapter {
    pub start_micros: i64,
    pub end_micros: i64,
    pub title: String,
}

pub struct ChapterMetadataFile {
    directory: PathBuf,
    path: PathBuf,
}

impl ChapterMetadataFile {
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for ChapterMetadataFile {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

pub fn create_chapter_metadata_file(
    chapters: Option<&[ExportChapter]>,
    trim: &TrimSelection,
    strip_metadata: bool,
) -> Result<Option<ChapterMetadataFile>, AppError> {
    let Some(chapters) = chapters.filter(|chapters| !strip_metadata && !chapters.is_empty()) else {
        return Ok(None);
    };
    let mut contents = String::from(";FFMETADATA1\n");
    for chapter in chapters {
        let start = chapter.start_micros.max(trim.start_micros);
        let end = chapter.end_micros.min(trim.end_micros);
        if end <= start {
            continue;
        }
        contents.push_str("[CHAPTER]\nTIMEBASE=1/1000000\n");
        contents.push_str(&format!(
            "START={}\nEND={}\n",
            start - trim.start_micros,
            end - trim.start_micros
        ));
        contents.push_str("title=");
        contents.push_str(&escape_ffmetadata_value(&chapter.title));
        contents.push('\n');
    }

    let directory =
        std::env::temp_dir().join(format!("easytrim-chapters-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&directory)
        .map_err(|_| AppError::internal("Chapter metadata could not be prepared."))?;
    let path = directory.join("chapters.ffmeta");
    let write_result = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .and_then(|mut file| file.write_all(contents.as_bytes()));
    if write_result.is_err() {
        let _ = fs::remove_dir_all(&directory);
        return Err(AppError::internal(
            "Chapter metadata could not be prepared.",
        ));
    }
    Ok(Some(ChapterMetadataFile { directory, path }))
}

pub fn output_supports_chapters(output_path: &Path) -> bool {
    output_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "mkv" | "mp4" | "mov" | "webm"
            )
        })
}

fn escape_ffmetadata_value(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        if matches!(character, '\\' | '=' | ';' | '#') {
            escaped.push('\\');
        }
        if character == '\n' {
            escaped.push_str("\\n");
        } else if character == '\r' {
            escaped.push_str("\\r");
        } else {
            escaped.push(character);
        }
    }
    escaped
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AudioExportFormat {
    M4a,
    Mp3,
    Wav,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioExportRequest {
    pub source_path: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    #[serde(default)]
    pub audio_metadata: Vec<AudioTrackMetadataSelection>,
    pub merge_audio: bool,
    #[serde(default)]
    pub strip_metadata: bool,
    pub format: AudioExportFormat,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackMetadataSelection {
    pub stream_index: u32,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    pub is_default: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizedExportRequest {
    pub source_path: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    #[serde(default)]
    pub audio_metadata: Vec<AudioTrackMetadataSelection>,
    pub merge_audio: bool,
    #[serde(default)]
    pub chapters: Option<Vec<ExportChapter>>,
    #[serde(default)]
    pub strip_metadata: bool,
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

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GifExportRequest {
    pub source_path: String,
    pub trim: TrimSelection,
    #[serde(default)]
    pub audio_tracks: Vec<AudioTrackSelection>,
    #[serde(default)]
    pub merge_audio: bool,
    pub rotation_degrees: u16,
    pub crop: Option<CropSelection>,
    #[serde(default)]
    pub flip_horizontal: bool,
    #[serde(default)]
    pub flip_vertical: bool,
    pub resolution: ResolutionSelection,
    #[serde(default)]
    pub frame_rate: Option<FrameRateSelection>,
    #[serde(default)]
    pub gif_preset: GifPreset,
    #[serde(default = "default_gif_palette_colors")]
    pub palette_colors: u16,
    #[serde(default)]
    pub palette_stats_mode: GifPaletteStatsMode,
    #[serde(default)]
    pub dithering: GifDithering,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GifPreset {
    Compact,
    #[default]
    Balanced,
    HighQuality,
    Custom,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GifPaletteStatsMode {
    #[default]
    Diff,
    Full,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GifDithering {
    None,
    Bayer,
    #[default]
    Sierra2_4a,
}

fn default_gif_palette_colors() -> u16 {
    256
}

#[cfg(test)]
pub fn build_fast_arguments(
    source: &MediaInfo,
    request: &FastExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    build_fast_arguments_with_chapters(source, request, source_path, output_path, None)
}

pub fn build_fast_arguments_with_chapters(
    source: &MediaInfo,
    request: &FastExportRequest,
    source_path: &Path,
    output_path: &Path,
    chapter_metadata_path: Option<&Path>,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    validate_export_chapters(source, request.chapters.as_deref())?;
    validate_audio_metadata_selection(source, &request.audio_tracks, &request.audio_metadata)?;
    validate_rotation(request.rotation_degrees)?;
    if request.rotation_degrees != 0 {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportFastExportCannotApplyRotationUseOptimizedExport,
        ));
    }
    validate_output_container(source, request, output_path)?;

    let mut arguments =
        common_input_arguments_with_chapters(source_path, &request.trim, chapter_metadata_path);
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
            OsString::from(audio_filter_graph(&request.audio_tracks, true)?),
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
            OsString::from(audio_filter_graph(&request.audio_tracks, false)?),
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
                OsString::from(format!("0:{}", track.stream_index())),
            ]);
        }
        arguments.extend([OsString::from("-c"), OsString::from("copy")]);
    }

    append_audio_metadata_arguments(
        &mut arguments,
        source,
        &request.audio_tracks,
        &request.audio_metadata,
        request.merge_audio && request.audio_tracks.len() > 1,
    );
    append_metadata_stripping_arguments(&mut arguments, request.strip_metadata);
    append_chapter_mapping_arguments(
        &mut arguments,
        request.chapters.as_deref(),
        chapter_metadata_path,
        request.strip_metadata,
    );
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

pub fn fast_export_output_extensions(
    source: &MediaInfo,
    request: &FastExportRequest,
) -> Result<Vec<&'static str>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    validate_audio_metadata_selection(source, &request.audio_tracks, &request.audio_metadata)?;
    validate_rotation(request.rotation_degrees)?;

    if request.rotation_degrees != 0
        || audio_tracks_need_reencode(&request.audio_tracks)
        || (request.merge_audio && request.audio_tracks.len() > 1)
    {
        return Ok(if container_supports_streams(source, request, "mkv") {
            vec!["mkv"]
        } else {
            Vec::new()
        });
    }

    Ok(["mkv", "mp4", "mov", "webm"]
        .into_iter()
        .filter(|extension| container_supports_streams(source, request, extension))
        .collect())
}

fn validate_output_container(
    source: &MediaInfo,
    request: &FastExportRequest,
    output_path: &Path,
) -> Result<(), AppError> {
    let extension = output_path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(incompatible_output_container)?;

    let allowed_extensions = fast_export_output_extensions(source, request)?;
    if allowed_extensions.contains(&extension.as_str()) {
        Ok(())
    } else {
        Err(incompatible_output_container())
    }
}

fn container_supports_streams(
    source: &MediaInfo,
    request: &FastExportRequest,
    extension: &str,
) -> bool {
    let video_codec = source.video.codec_name.to_ascii_lowercase();
    let generated_audio = audio_tracks_need_reencode(&request.audio_tracks)
        || (request.merge_audio && request.audio_tracks.len() > 1);
    let audio_codecs = if generated_audio {
        if request.audio_tracks.is_empty() {
            Vec::new()
        } else {
            vec!["aac".to_owned()]
        }
    } else {
        request
            .audio_tracks
            .iter()
            .filter_map(|selection| {
                source
                    .audio_streams
                    .iter()
                    .find(|stream| stream.stream_index == selection.stream_index())
                    .map(|stream| stream.codec_name.to_ascii_lowercase())
            })
            .collect()
    };

    let video_supported = match extension {
        "mp4" => matches!(video_codec.as_str(), "h264" | "hevc" | "av1" | "mpeg4"),
        "mov" => matches!(
            video_codec.as_str(),
            "h264" | "hevc" | "prores" | "mjpeg" | "mpeg4"
        ),
        "mkv" => matches!(
            video_codec.as_str(),
            "h264" | "hevc" | "av1" | "vp8" | "vp9" | "mpeg4" | "mpeg2video" | "mpeg1video"
        ),
        "webm" => matches!(video_codec.as_str(), "vp8" | "vp9" | "av1"),
        _ => false,
    };
    video_supported
        && audio_codecs.iter().all(|codec| match extension {
            "mp4" => matches!(codec.as_str(), "aac" | "mp3" | "ac3"),
            "mov" => matches!(codec.as_str(), "aac" | "mp3" | "ac3" | "alac" | "pcm_s16le"),
            "mkv" => matches!(
                codec.as_str(),
                "aac"
                    | "mp3"
                    | "ac3"
                    | "eac3"
                    | "opus"
                    | "vorbis"
                    | "flac"
                    | "alac"
                    | "pcm_s16le"
                    | "pcm_s24le"
            ),
            "webm" => matches!(codec.as_str(), "opus" | "vorbis"),
            _ => false,
        })
}

fn incompatible_output_container() -> AppError {
    AppError::invalid_request(
        AppErrorMessageId::ExportOutputContainerIsNotCompatibleWithSelectedStreams,
    )
}

pub fn build_audio_arguments(
    source: &MediaInfo,
    request: &AudioExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    validate_audio_metadata_selection(source, &request.audio_tracks, &request.audio_metadata)?;
    if request.audio_tracks.is_empty() {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportAudioTrackIsRequired,
        ));
    }
    if matches!(
        request.format,
        AudioExportFormat::Mp3 | AudioExportFormat::Wav
    ) && request.audio_tracks.len() > 1
        && !request.merge_audio
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportAudioRequiresMergedTracks,
        ));
    }

    let mut arguments = common_input_arguments(source_path, &request.trim);
    let merge = request.merge_audio && request.audio_tracks.len() > 1;
    if merge {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, true)?),
            OsString::from("-map"),
            OsString::from("[aout]"),
            OsString::from("-ac"),
            OsString::from("2"),
        ]);
    } else if audio_tracks_need_reencode(&request.audio_tracks) {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, false)?),
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
                OsString::from(format!("0:{}", track.stream_index())),
            ]);
        }
    }
    arguments.extend([
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
    ]);
    match request.format {
        AudioExportFormat::M4a => arguments.extend([
            OsString::from("-c:a"),
            OsString::from("aac"),
            OsString::from("-b:a"),
            OsString::from("192k"),
            OsString::from("-f"),
            OsString::from("ipod"),
        ]),
        AudioExportFormat::Mp3 => arguments.extend([
            OsString::from("-c:a"),
            OsString::from("libmp3lame"),
            OsString::from("-b:a"),
            OsString::from("192k"),
            OsString::from("-f"),
            OsString::from("mp3"),
        ]),
        AudioExportFormat::Wav => {
            arguments.extend([OsString::from("-c:a"), OsString::from("pcm_s16le")]);
        }
    }
    append_audio_metadata_arguments(
        &mut arguments,
        source,
        &request.audio_tracks,
        &request.audio_metadata,
        merge,
    );
    append_metadata_stripping_arguments(&mut arguments, request.strip_metadata);
    arguments.extend([OsString::from("-y"), output_path.as_os_str().to_owned()]);
    Ok(arguments)
}

#[cfg(test)]
pub fn build_optimized_arguments(
    source: &MediaInfo,
    request: &OptimizedExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    build_optimized_arguments_with_chapters(source, request, source_path, output_path, None)
}

pub fn build_optimized_arguments_with_chapters(
    source: &MediaInfo,
    request: &OptimizedExportRequest,
    source_path: &Path,
    output_path: &Path,
    chapter_metadata_path: Option<&Path>,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    validate_export_chapters(source, request.chapters.as_deref())?;
    validate_audio_metadata_selection(source, &request.audio_tracks, &request.audio_metadata)?;
    validate_resolution(&request.resolution)?;
    validate_crop(request.crop.as_ref())?;
    validate_rotation(request.rotation_degrees)?;
    if let Some(frame_rate) = &request.frame_rate
        && (frame_rate.numerator == 0 || frame_rate.denominator == 0)
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportOutputFrameRateIsInvalid,
        ));
    }

    let mut arguments =
        common_input_arguments_with_chapters(source_path, &request.trim, chapter_metadata_path);
    arguments.extend([
        OsString::from("-map"),
        OsString::from(format!("0:{}", source.video.stream_index)),
    ]);
    if request.merge_audio && request.audio_tracks.len() > 1 {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, true)?),
            OsString::from("-map"),
            OsString::from("[aout]"),
            OsString::from("-ac"),
            OsString::from("2"),
        ]);
    } else if audio_tracks_need_reencode(&request.audio_tracks) {
        arguments.extend([
            OsString::from("-filter_complex"),
            OsString::from(audio_filter_graph(&request.audio_tracks, false)?),
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
                OsString::from(format!("0:{}", track.stream_index())),
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
    validate_user_arguments(&user_arguments, request.strip_metadata)?;
    arguments.extend(user_arguments);
    append_audio_metadata_arguments(
        &mut arguments,
        source,
        &request.audio_tracks,
        &request.audio_metadata,
        request.merge_audio && request.audio_tracks.len() > 1,
    );
    append_metadata_stripping_arguments(&mut arguments, request.strip_metadata);
    append_chapter_mapping_arguments(
        &mut arguments,
        request.chapters.as_deref(),
        chapter_metadata_path,
        request.strip_metadata,
    );
    arguments.extend([
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-y"),
        output_path.as_os_str().to_owned(),
    ]);
    Ok(arguments)
}

pub fn build_gif_arguments(
    source: &MediaInfo,
    request: &GifExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_trim_selection(source, &request.trim)?;
    if !request.audio_tracks.is_empty() || request.merge_audio {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
        ));
    }
    validate_rotation(request.rotation_degrees)?;
    validate_crop(request.crop.as_ref())?;
    validate_resolution(&request.resolution)?;
    if !matches!(request.palette_colors, 16 | 32 | 64 | 128 | 256) {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportGifEncodingSettingsAreInvalid,
        ));
    }
    if let Some(frame_rate) = &request.frame_rate
        && (frame_rate.numerator == 0
            || frame_rate.denominator == 0
            || frame_rate.numerator as u128 > frame_rate.denominator as u128 * 120)
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportOutputFrameRateIsInvalid,
        ));
    }

    let (rotation_degrees, flip_horizontal, flip_vertical, crop) =
        if request.rotation_degrees == 180 && request.flip_horizontal && request.flip_vertical {
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
        } else {
            (
                request.rotation_degrees,
                request.flip_horizontal,
                request.flip_vertical,
                request.crop.clone(),
            )
        };
    let mut video_filters = Vec::new();
    if rotation_degrees != 0 {
        video_filters.push(rotation_filter(rotation_degrees));
    }
    if let Some(crop) = crop {
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
    if let Some(frame_rate) = &request.frame_rate {
        video_filters.push(format!(
            "fps={}/{}",
            frame_rate.numerator, frame_rate.denominator
        ));
    }
    video_filters.push(format!(
        "scale=w='min({},{}*dar)':h='min({},{}/dar)':eval=init:flags=lanczos,setsar=1",
        request.resolution.width,
        request.resolution.height,
        request.resolution.height,
        request.resolution.width,
    ));
    let filter = format!(
        "[0:{}]{},split[v1][v2];[v1]palettegen=max_colors={}:stats_mode={}[palette];[v2][palette]paletteuse=dither={}[out]",
        source.video.stream_index,
        video_filters.join(","),
        request.palette_colors,
        match request.palette_stats_mode {
            GifPaletteStatsMode::Diff => "diff",
            GifPaletteStatsMode::Full => "full",
        },
        match request.dithering {
            GifDithering::None => "none",
            GifDithering::Bayer => "bayer",
            GifDithering::Sierra2_4a => "sierra2_4a",
        }
    );

    let mut arguments = common_input_arguments(source_path, &request.trim);
    arguments.extend([
        OsString::from("-filter_complex"),
        OsString::from(filter),
        OsString::from("-map"),
        OsString::from("[out]"),
        OsString::from("-an"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-loop"),
        OsString::from("0"),
        OsString::from("-f"),
        OsString::from("gif"),
        OsString::from("-y"),
        output_path.as_os_str().to_owned(),
    ]);
    Ok(arguments)
}

pub fn optimized_command_preview(
    source: &MediaInfo,
    request: &OptimizedExportRequest,
) -> Result<String, AppError> {
    let chapter_metadata_path = request
        .chapters
        .as_ref()
        .filter(|chapters| !chapters.is_empty() && !request.strip_metadata)
        .map(|_| Path::new("<chapters>"));
    let arguments = build_optimized_arguments_with_chapters(
        source,
        request,
        Path::new("<source>"),
        Path::new("<output>"),
        chapter_metadata_path,
    )?;
    Ok(command_preview(arguments))
}

pub fn gif_command_preview(
    source: &MediaInfo,
    request: &GifExportRequest,
) -> Result<String, AppError> {
    let arguments = build_gif_arguments(
        source,
        request,
        Path::new("<source>"),
        Path::new("<output>"),
    )?;
    Ok(command_preview(arguments))
}

fn command_preview(arguments: Vec<OsString>) -> String {
    std::iter::once(OsString::from("ffmpeg"))
        .chain(arguments)
        .map(|argument| quote_preview_argument(&argument))
        .collect::<Vec<_>>()
        .join(" ")
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

fn common_input_arguments_with_chapters(
    source_path: &Path,
    trim: &TrimSelection,
    chapter_metadata_path: Option<&Path>,
) -> Vec<OsString> {
    let mut arguments = common_input_arguments(source_path, trim);
    if let Some(chapter_metadata_path) = chapter_metadata_path {
        let output_duration = arguments.pop().expect("common input duration exists");
        let duration_option = arguments
            .pop()
            .expect("common input duration option exists");
        arguments.extend([
            OsString::from("-f"),
            OsString::from("ffmetadata"),
            OsString::from("-i"),
            chapter_metadata_path.as_os_str().to_owned(),
            duration_option,
            output_duration,
        ]);
    }
    arguments
}

fn append_chapter_mapping_arguments(
    arguments: &mut Vec<OsString>,
    chapters: Option<&[ExportChapter]>,
    chapter_metadata_path: Option<&Path>,
    strip_metadata: bool,
) {
    if strip_metadata {
        return;
    }
    if chapters.is_some() && chapter_metadata_path.is_none() {
        arguments.extend([OsString::from("-map_chapters"), OsString::from("-1")]);
    } else if chapter_metadata_path.is_some() {
        arguments.extend([OsString::from("-map_chapters"), OsString::from("1")]);
    }
}

fn validate_export_chapters(
    source: &MediaInfo,
    chapters: Option<&[ExportChapter]>,
) -> Result<(), AppError> {
    if chapters.is_some_and(|chapters| {
        chapters.iter().any(|chapter| {
            chapter.start_micros < 0
                || chapter.end_micros <= chapter.start_micros
                || chapter.end_micros > source.duration_micros
                || chapter.title.trim().is_empty()
                || chapter.title.chars().count() > 256
                || chapter.title.chars().any(char::is_control)
        })
    }) {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportSelectedExportRangeIsInvalid,
        ));
    }
    Ok(())
}

fn append_metadata_stripping_arguments(arguments: &mut Vec<OsString>, strip_metadata: bool) {
    if strip_metadata {
        arguments.extend([
            OsString::from("-map_metadata"),
            OsString::from("-1"),
            OsString::from("-map_chapters"),
            OsString::from("-1"),
        ]);
    }
}

pub(crate) fn validate_common_request(
    source: &MediaInfo,
    trim: &TrimSelection,
    audio_tracks: &[AudioTrackSelection],
) -> Result<(), AppError> {
    validate_trim_selection(source, trim)?;
    validate_audio_track_selections(source, audio_tracks)
}

pub(crate) fn validate_trim_selection(
    source: &MediaInfo,
    trim: &TrimSelection,
) -> Result<(), AppError> {
    if trim.start_micros < 0
        || trim.end_micros <= trim.start_micros
        || trim.end_micros > source.duration_micros
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportSelectedExportRangeIsInvalid,
        ));
    }
    Ok(())
}

pub(crate) fn validate_audio_stream(source: &MediaInfo, stream_index: u32) -> Result<(), AppError> {
    if source
        .audio_streams
        .iter()
        .any(|stream| stream.stream_index == stream_index)
    {
        Ok(())
    } else {
        Err(AppError::invalid_request(
            AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
        ))
    }
}

/// Validates stream membership, Track Volume, and that every chain compiles with the
/// measurements its loudness normalization instances require.
pub(crate) fn validate_audio_track_selections(
    source: &MediaInfo,
    audio_tracks: &[AudioTrackSelection],
) -> Result<(), AppError> {
    let mut selected_streams = HashSet::new();
    for track in audio_tracks {
        validate_audio_stream(source, track.stream_index())?;
        if !selected_streams.insert(track.stream_index()) {
            return Err(AppError::invalid_request(
                AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
            ));
        }
        validate_track_volume(track.volume)?;
        compile_chain(&track.chain.filters, &track.chain.loudness_measurements)?;
    }
    Ok(())
}

fn validate_audio_metadata_selection(
    source: &MediaInfo,
    audio_tracks: &[AudioTrackSelection],
    audio_metadata: &[AudioTrackMetadataSelection],
) -> Result<(), AppError> {
    if audio_metadata.is_empty() {
        return Ok(());
    }

    let selected_streams = audio_tracks
        .iter()
        .map(|track| track.stream_index())
        .collect::<HashSet<_>>();
    let mut metadata_streams = HashSet::new();
    let default_count = audio_metadata
        .iter()
        .filter(|metadata| metadata.is_default)
        .count();

    if audio_metadata.len() != audio_tracks.len()
        || audio_metadata.iter().any(|metadata| {
            !selected_streams.contains(&metadata.stream_index)
                || !metadata_streams.insert(metadata.stream_index)
                || !source
                    .audio_streams
                    .iter()
                    .any(|stream| stream.stream_index == metadata.stream_index)
                || metadata.title.as_ref().is_some_and(|title| {
                    title.chars().count() > 256 || title.chars().any(char::is_control)
                })
                || metadata.language.as_ref().is_some_and(|language| {
                    language.len() > 16
                        || !language
                            .chars()
                            .all(|character| character.is_ascii_alphanumeric() || character == '-')
                })
        })
        || (!audio_tracks.is_empty() && default_count != 1)
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
        ));
    }

    Ok(())
}

fn append_audio_metadata_arguments(
    arguments: &mut Vec<OsString>,
    source: &MediaInfo,
    audio_tracks: &[AudioTrackSelection],
    audio_metadata: &[AudioTrackMetadataSelection],
    merged: bool,
) {
    if audio_tracks.is_empty() {
        return;
    }

    if merged {
        arguments.extend([
            OsString::from("-metadata:s:a:0"),
            OsString::from("title=Merged audio"),
            OsString::from("-metadata:s:a:0"),
            OsString::from("language=und"),
            OsString::from("-disposition:a:0"),
            OsString::from("default"),
        ]);
        return;
    }

    let selected_default = audio_metadata
        .iter()
        .find(|metadata| metadata.is_default)
        .map(|metadata| metadata.stream_index)
        .or_else(|| {
            source
                .audio_streams
                .iter()
                .find(|stream| {
                    stream.is_default
                        && audio_tracks
                            .iter()
                            .any(|track| track.stream_index() == stream.stream_index)
                })
                .map(|stream| stream.stream_index)
        })
        .unwrap_or(audio_tracks[0].stream_index());

    for (output_index, track) in audio_tracks.iter().enumerate() {
        let metadata = audio_metadata
            .iter()
            .find(|metadata| metadata.stream_index == track.stream_index());
        let source_stream = source
            .audio_streams
            .iter()
            .find(|stream| stream.stream_index == track.stream_index());
        let title = metadata
            .and_then(|metadata| metadata.title.as_deref())
            .or(source_stream.and_then(|stream| stream.title.as_deref()))
            .unwrap_or_default();
        let language = metadata
            .and_then(|metadata| metadata.language.as_deref())
            .or(source_stream.and_then(|stream| stream.language.as_deref()))
            .unwrap_or_default();
        let disposition = if track.stream_index() == selected_default {
            "+default"
        } else {
            "-default"
        };

        arguments.extend([
            OsString::from(format!("-metadata:s:a:{output_index}")),
            OsString::from(format!("title={title}")),
            OsString::from(format!("-metadata:s:a:{output_index}")),
            OsString::from(format!("language={language}")),
            OsString::from(format!("-disposition:a:{output_index}")),
            OsString::from(disposition),
        ]);
    }
}

fn validate_resolution(resolution: &ResolutionSelection) -> Result<(), AppError> {
    if resolution.width == 0 || resolution.height == 0 {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportOutputResolutionMustBeGreaterThanZero,
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
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportCropSelectionIsInvalid,
        ));
    }
    Ok(())
}

fn validate_rotation(rotation_degrees: u16) -> Result<(), AppError> {
    if matches!(rotation_degrees, 0 | 90 | 180 | 270) {
        Ok(())
    } else {
        Err(AppError::invalid_request(
            AppErrorMessageId::ExportRotationMustBe090180Or270Degrees,
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
    audio_tracks
        .iter()
        .any(AudioTrackSelection::needs_processing)
}

pub(crate) fn audio_filter_graph(
    audio_tracks: &[AudioTrackSelection],
    merge: bool,
) -> Result<String, AppError> {
    let mut graph = audio_tracks
        .iter()
        .enumerate()
        .map(|(index, track)| {
            Ok(format!(
                "[0:{}]{}[audio{index}]",
                track.stream_index(),
                track_graph(track)?
            ))
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    if merge {
        let inputs = (0..audio_tracks.len())
            .map(|index| format!("[audio{index}]"))
            .collect::<String>();
        graph.push(format!(
            "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
            audio_tracks.len()
        ));
    }
    Ok(graph.join(";"))
}

/// The ordered filters followed by Track Volume, which applies after every filter and before any
/// mixing.
fn track_graph(track: &AudioTrackSelection) -> Result<String, AppError> {
    let chain = compile_chain(&track.chain.filters, &track.chain.loudness_measurements)?;
    let mut stages = chain.processing_graph().into_iter().collect::<Vec<_>>();
    if track.volume != 1.0 {
        stages.push(format!("volume={}:precision=double", track.volume));
    }
    Ok(if stages.is_empty() {
        "anull".to_owned()
    } else {
        stages.join(",")
    })
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
            AppErrorMessageId::ExportOptimizedFfmpegArgumentsContainAnUnclosedQuote,
        ));
    }
    if !current.is_empty() {
        arguments.push(OsString::from(current));
    }
    Ok(arguments)
}

fn validate_user_arguments(arguments: &[OsString], strip_metadata: bool) -> Result<(), AppError> {
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
        if strip_metadata && matches!(option, "-metadata" | "-metadata:g") {
            return Err(AppError::invalid_request(
                AppErrorMessageId::ExportGlobalMetadataCannotBeSetWhenStrippingMetadata,
            ));
        }
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
            AppErrorMessageId::ExportFinalOptimizedFfmpegOptionIsMissingItsValue,
        ));
    }
    Ok(())
}

fn invalid_optimized_arguments() -> AppError {
    AppError::invalid_request(
        AppErrorMessageId::ExportOptimizedArgumentsCannotOverrideInputTrimMappingFiltersOutputFormatOrOutputPaths,
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
    use std::process::Command;

    use super::{
        AudioExportFormat, AudioExportRequest, AudioTrackMetadataSelection, AudioTrackSelection,
        CropSelection, FastExportRequest, FrameRateSelection, GifDithering, GifExportRequest,
        GifPaletteStatsMode, GifPreset, OptimizedExportRequest, ResolutionSelection, TrimSelection,
        append_audio_metadata_arguments, audio_filter_graph, build_audio_arguments,
        build_fast_arguments, build_gif_arguments, build_optimized_arguments,
        fast_export_output_extensions, gif_command_preview, optimized_command_preview,
    };
    use crate::error::AppErrorMessageId;
    use crate::media::audio_filters::model::{
        AudioChainSelection, AudioFilter, AudioLoudnessAnalysis, FilterMeasurement, fixtures::*,
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
                frame_count: None,
                rotation_degrees: None,
                frame_timestamps_micros: Vec::new(),
            },
            audio_streams: vec![
                AudioStream {
                    stream_index: 1,
                    codec_name: "aac".to_owned(),
                    channels: Some(2),
                    channel_layout: Some("stereo".to_owned()),
                    sample_rate_hz: Some(48_000),
                    start_time_micros: None,
                    duration_micros: None,
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
                    start_time_micros: None,
                    duration_micros: None,
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
            audio_tracks: vec![audio_track(1)],
            audio_metadata: Vec::new(),
            merge_audio: false,
            chapters: None,
            rotation_degrees: 0,
            strip_metadata: false,
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

    fn gif_request() -> GifExportRequest {
        GifExportRequest {
            source_path: "source.mkv".to_owned(),
            trim: TrimSelection {
                start_micros: 1_250_000,
                end_micros: 4_750_000,
            },
            audio_tracks: Vec::new(),
            merge_audio: false,
            rotation_degrees: 90,
            crop: Some(CropSelection {
                x: 0.1,
                y: 0.2,
                width: 0.7,
                height: 0.6,
            }),
            flip_horizontal: true,
            flip_vertical: true,
            resolution: ResolutionSelection {
                width: 640,
                height: 480,
            },
            frame_rate: Some(FrameRateSelection {
                numerator: 24,
                denominator: 1,
            }),
            gif_preset: GifPreset::Balanced,
            palette_colors: 256,
            palette_stats_mode: GifPaletteStatsMode::Diff,
            dithering: GifDithering::Sierra2_4a,
        }
    }

    fn gif_error_id(request: &GifExportRequest) -> crate::error::AppErrorMessageId {
        build_gif_arguments(
            &media(),
            request,
            Path::new("source.mkv"),
            Path::new("out.gif"),
        )
        .expect_err("GIF settings should be rejected")
        .message_id
    }

    fn audio_track(stream_index: u32) -> AudioTrackSelection {
        processed_track(stream_index, Vec::new(), Vec::new(), 1.0)
    }

    fn processed_track(
        stream_index: u32,
        filters: Vec<AudioFilter>,
        loudness_measurements: Vec<FilterMeasurement>,
        volume: f64,
    ) -> AudioTrackSelection {
        AudioTrackSelection {
            chain: AudioChainSelection {
                stream_index,
                filters,
                loudness_measurements,
            },
            volume,
        }
    }

    fn measurement(filter_id: &str) -> FilterMeasurement {
        FilterMeasurement {
            filter_id: filter_id.to_owned(),
            analysis: AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-9.0),
            },
        }
    }

    fn filter_graph(arguments: &[std::ffi::OsString]) -> String {
        let values = arguments
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        let index = values
            .iter()
            .position(|value| value == "-filter_complex")
            .expect("the export builds a filter graph");
        values[index + 1].clone()
    }

    fn fast_request(audio_tracks: Vec<AudioTrackSelection>) -> FastExportRequest {
        FastExportRequest {
            source_path: "source.mkv".to_owned(),
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 2_000_000,
            },
            audio_tracks,
            audio_metadata: Vec::new(),
            merge_audio: false,
            chapters: None,
            strip_metadata: false,
            rotation_degrees: 0,
        }
    }

    fn audio_request(format: AudioExportFormat, merge_audio: bool) -> AudioExportRequest {
        let optimized = optimized_request("");
        AudioExportRequest {
            source_path: optimized.source_path,
            trim: optimized.trim,
            audio_tracks: optimized.audio_tracks,
            audio_metadata: Vec::new(),
            merge_audio,
            strip_metadata: false,
            format,
        }
    }

    #[test]
    fn audio_export_omits_video_and_encodes_m4a_as_aac() {
        let args = build_audio_arguments(
            &media(),
            &audio_request(AudioExportFormat::M4a, false),
            Path::new("source.mkv"),
            Path::new("out.m4a"),
        )
        .expect("audio request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(values.windows(2).any(|pair| pair == ["-map", "0:1"]));
        assert!(values.contains(&"-vn".to_owned()));
        assert!(!values.contains(&"0:0".to_owned()));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(values.windows(2).any(|pair| pair == ["-f", "ipod"]));
        assert!(!values.contains(&"-vf".to_owned()));
    }

    #[test]
    fn audio_export_applies_selected_metadata_and_strip_preference() {
        let mut request = audio_request(AudioExportFormat::M4a, false);
        request.audio_metadata = vec![AudioTrackMetadataSelection {
            stream_index: 1,
            title: Some("Edited title".to_owned()),
            language: Some("rus".to_owned()),
            is_default: true,
        }];
        request.strip_metadata = true;
        let args = build_audio_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.m4a"),
        )
        .expect("audio metadata request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "title=Edited title"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "language=rus"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-disposition:a:0", "+default"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-map_metadata", "-1"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-map_chapters", "-1"])
        );
    }

    #[test]
    fn merged_audio_export_uses_merged_track_metadata_convention() {
        let mut request = audio_request(AudioExportFormat::Wav, true);
        request.audio_tracks.push(audio_track(2));
        request.audio_metadata = vec![
            AudioTrackMetadataSelection {
                stream_index: 1,
                title: Some("Edited first".to_owned()),
                language: Some("eng".to_owned()),
                is_default: true,
            },
            AudioTrackMetadataSelection {
                stream_index: 2,
                title: Some("Edited second".to_owned()),
                language: Some("rus".to_owned()),
                is_default: false,
            },
        ];
        let args = build_audio_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.wav"),
        )
        .expect("merged audio request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "title=Merged audio"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "language=und"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-disposition:a:0", "default"])
        );
        assert!(!values.iter().any(|value| value == "title=Edited first"));
        assert!(!values.iter().any(|value| value == "title=Edited second"));
    }

    #[test]
    fn audio_export_merges_selected_tracks_for_wav() {
        let mut request = audio_request(AudioExportFormat::Wav, true);
        request.audio_tracks.push(audio_track(2));
        let args = build_audio_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.wav"),
        )
        .expect("merged WAV request is valid");
        let values = args
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(values.iter().any(|value| value.contains("amix=inputs=2")));
        assert!(values.windows(2).any(|pair| pair == ["-map", "[aout]"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "pcm_s16le"]));
    }

    #[test]
    fn audio_export_rejects_empty_track_selection() {
        let mut request = audio_request(AudioExportFormat::M4a, false);
        request.audio_tracks.clear();
        let error = build_audio_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.m4a"),
        )
        .expect_err("audio export requires selected tracks");

        assert_eq!(
            error.message_id,
            AppErrorMessageId::ExportAudioTrackIsRequired
        );
    }

    #[test]
    fn wav_audio_export_requires_merging_multiple_tracks() {
        let mut request = audio_request(AudioExportFormat::Wav, false);
        request.audio_tracks.push(audio_track(2));
        let error = build_audio_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.wav"),
        )
        .expect_err("WAV requires merged selected tracks");

        assert_eq!(
            error.message_id,
            AppErrorMessageId::ExportAudioRequiresMergedTracks
        );
    }

    #[test]
    fn remux_choices_include_only_containers_compatible_with_all_selected_codecs() {
        let mut source = media();
        source.video.codec_name = "vp9".to_owned();
        source.audio_streams[0].codec_name = "opus".to_owned();

        let extensions =
            fast_export_output_extensions(&source, &fast_request(vec![audio_track(1)]))
                .expect("valid selection");

        assert_eq!(extensions, ["mkv", "webm"]);
    }

    #[test]
    fn remux_choices_fall_back_to_matroska_when_audio_must_be_encoded() {
        let mut request = fast_request(vec![audio_track(1)]);
        request.audio_tracks[0].volume = 1.5;

        assert_eq!(
            fast_export_output_extensions(&media(), &request).expect("valid selection"),
            ["mkv"]
        );
    }

    #[test]
    fn fast_export_accepts_only_picker_extensions_when_audio_must_be_encoded() {
        let source = media();
        let mut request = fast_request(vec![audio_track(1)]);
        request.audio_tracks[0].volume = 1.5;
        let allowed_extensions =
            fast_export_output_extensions(&source, &request).expect("valid selection");

        for extension in ["mkv", "mp4", "mov", "webm"] {
            let accepted = build_fast_arguments(
                &source,
                &request,
                Path::new("source.mkv"),
                Path::new(&format!("output.{extension}")),
            )
            .is_ok();

            assert_eq!(
                accepted,
                allowed_extensions.contains(&extension),
                "native validation and picker disagree for .{extension}"
            );
        }
    }

    #[test]
    fn fast_export_rejects_an_incompatible_output_container() {
        let mut source = media();
        source.video.codec_name = "vp9".to_owned();
        source.audio_streams[0].codec_name = "opus".to_owned();
        let error = build_fast_arguments(
            &source,
            &fast_request(vec![audio_track(1)]),
            Path::new("source.webm"),
            Path::new("output.mp4"),
        )
        .expect_err("VP9 and Opus cannot be remuxed to MP4");

        assert_eq!(
            error.message_id,
            AppErrorMessageId::ExportOutputContainerIsNotCompatibleWithSelectedStreams
        );
    }

    #[test]
    fn audio_metadata_follows_selected_output_order_and_preserves_empty_overrides() {
        let selected_tracks = vec![audio_track(2), audio_track(1)];
        let metadata = vec![
            AudioTrackMetadataSelection {
                stream_index: 1,
                title: Some("Commentary".to_owned()),
                language: Some("en".to_owned()),
                is_default: false,
            },
            AudioTrackMetadataSelection {
                stream_index: 2,
                title: Some(String::new()),
                language: Some("fr".to_owned()),
                is_default: true,
            },
        ];
        let mut arguments = Vec::new();
        append_audio_metadata_arguments(
            &mut arguments,
            &media(),
            &selected_tracks,
            &metadata,
            false,
        );
        let values = arguments
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "title="])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "language=fr"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-disposition:a:0", "+default"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:1", "title=Commentary"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-disposition:a:1", "-default"])
        );
    }

    #[test]
    fn merged_audio_receives_explicit_merged_metadata() {
        let mut arguments = Vec::new();
        append_audio_metadata_arguments(
            &mut arguments,
            &media(),
            &[audio_track(1), audio_track(2)],
            &[],
            true,
        );
        let values = arguments
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "title=Merged audio"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-metadata:s:a:0", "language=und"])
        );
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-disposition:a:0", "default"])
        );
    }

    #[test]
    fn metadata_arguments_only_include_enabled_selected_audio_tracks() {
        let mut arguments = Vec::new();
        append_audio_metadata_arguments(
            &mut arguments,
            &media(),
            &[audio_track(2)],
            &[AudioTrackMetadataSelection {
                stream_index: 2,
                title: None,
                language: None,
                is_default: true,
            }],
            false,
        );
        let values = arguments
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(values.iter().all(|value| !value.contains(":a:1")));
        assert!(
            values
                .windows(2)
                .any(|pair| pair == ["-disposition:a:0", "+default"])
        );
    }

    #[test]
    fn ffmpeg_preserves_unrelated_dispositions_for_copy_and_processed_audio() {
        let ffmpeg = which::which("ffmpeg").expect("FFmpeg is required for this integration test");
        let ffprobe =
            which::which("ffprobe").expect("FFprobe is required for this integration test");
        let directory =
            std::env::temp_dir().join(format!("easytrim-audio-metadata-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).expect("temporary fixture directory should be created");
        let source_path = directory.join("source.mkv");
        let source = Command::new(&ffmpeg)
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=1",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=880:duration=1",
                "-map",
                "0:a:0",
                "-map",
                "1:a:0",
                "-c:a",
                "aac",
                "-disposition:a:0",
                "forced+comment+original+hearing_impaired",
                "-disposition:a:1",
                "default",
                "-y",
            ])
            .arg(&source_path)
            .output()
            .expect("ffmpeg should launch");
        assert!(
            source.status.success(),
            "fixture generation failed: {}",
            String::from_utf8_lossy(&source.stderr)
        );

        for container in ["mp4", "mkv"] {
            for processed in [false, true] {
                let output_path = directory.join(format!(
                    "{}.{container}",
                    if processed { "processed" } else { "copy" }
                ));
                let mut command = Command::new(&ffmpeg);
                command
                    .args(["-hide_banner", "-loglevel", "error", "-i"])
                    .arg(&source_path)
                    .args(["-map", "0:a:0", "-map", "0:a:1"]);
                if processed {
                    command.args([
                        "-filter:a:0",
                        "volume=0.8",
                        "-filter:a:1",
                        "volume=0.8",
                        "-c:a",
                        "aac",
                    ]);
                } else {
                    command.args(["-c:a", "copy"]);
                }
                let exported = command
                    .args([
                        "-disposition:a:0",
                        "+default",
                        "-disposition:a:1",
                        "-default",
                        "-y",
                    ])
                    .arg(&output_path)
                    .output()
                    .expect("ffmpeg should launch");
                assert!(
                    exported.status.success(),
                    "{container} export failed: {}",
                    String::from_utf8_lossy(&exported.stderr)
                );

                let probe = Command::new(&ffprobe)
                    .args([
                        "-v",
                        "error",
                        "-show_entries",
                        "stream=index:stream_disposition=default,forced,comment,original,hearing_impaired",
                        "-of",
                        "json",
                    ])
                    .arg(&output_path)
                    .output()
                    .expect("ffprobe should launch");
                assert!(probe.status.success(), "ffprobe failed for {container}");
                let json: serde_json::Value =
                    serde_json::from_slice(&probe.stdout).expect("ffprobe output should be JSON");
                let streams = json["streams"]
                    .as_array()
                    .expect("streams should be present");
                assert_eq!(streams.len(), 2);
                assert_eq!(streams[0]["disposition"]["default"], 1);
                assert_eq!(streams[1]["disposition"]["default"], 0);
                for flag in ["forced", "comment", "hearing_impaired"] {
                    assert_eq!(
                        streams[0]["disposition"][flag], 1,
                        "{flag} was lost in {container}"
                    );
                }
                if container == "mkv" {
                    assert_eq!(streams[0]["disposition"]["original"], 1);
                }
            }
        }

        std::fs::remove_dir_all(directory).expect("temporary fixtures should be removed");
    }

    #[test]
    fn fast_and_optimized_exports_apply_default_and_language_metadata() {
        let ffmpeg = which::which("ffmpeg").expect("FFmpeg is required for this integration test");
        let ffprobe =
            which::which("ffprobe").expect("FFprobe is required for this integration test");
        let directory = std::env::temp_dir().join(format!(
            "easytrim-fast-audio-metadata-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&directory).expect("temporary fixture directory should be created");
        let source_path = directory.join("source.mkv");
        let source = Command::new(&ffmpeg)
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=32x32:r=25:d=1",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=1",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=880:duration=1",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-map",
                "2:a:0",
                "-c:v",
                "mpeg4",
                "-c:a",
                "aac",
                "-metadata:s:a:0",
                "title=Source English",
                "-metadata:s:a:0",
                "language=eng",
                "-metadata:s:a:1",
                "title=Source Russian",
                "-metadata:s:a:1",
                "language=rus",
                "-disposition:a:0",
                "default+forced+comment+original+hearing_impaired",
                "-disposition:a:1",
                "0",
                "-y",
            ])
            .arg(&source_path)
            .output()
            .expect("ffmpeg should launch");
        assert!(
            source.status.success(),
            "fixture generation failed: {}",
            String::from_utf8_lossy(&source.stderr)
        );

        let mut source_media = media();
        source_media.audio_streams[0].title = Some("Source English".to_owned());
        source_media.audio_streams[0].language = Some("eng".to_owned());
        source_media.audio_streams[1].title = Some("Source Russian".to_owned());
        source_media.audio_streams[1].language = Some("rus".to_owned());
        let audio_metadata = vec![
            AudioTrackMetadataSelection {
                stream_index: 1,
                title: Some("English commentary".to_owned()),
                language: Some("eng".to_owned()),
                is_default: false,
            },
            AudioTrackMetadataSelection {
                stream_index: 2,
                title: None,
                language: Some("rus".to_owned()),
                is_default: true,
            },
        ];

        for container in ["mp4", "mkv"] {
            for route in ["fast", "optimized"] {
                let output_path = directory.join(format!("{route}.{container}"));
                let arguments = if route == "fast" {
                    build_fast_arguments(
                        &source_media,
                        &FastExportRequest {
                            source_path: source_path.to_string_lossy().into_owned(),
                            trim: TrimSelection {
                                start_micros: 0,
                                end_micros: 1_000_000,
                            },
                            audio_tracks: vec![audio_track(1), audio_track(2)],
                            audio_metadata: audio_metadata.clone(),
                            merge_audio: false,
                            chapters: None,
                            strip_metadata: false,
                            rotation_degrees: 0,
                        },
                        &source_path,
                        &output_path,
                    )
                    .expect("Fast Export arguments should be valid")
                } else {
                    let mut request = optimized_request("-c:v mpeg4");
                    request.source_path = source_path.to_string_lossy().into_owned();
                    request.trim.end_micros = 1_000_000;
                    request.audio_tracks = vec![audio_track(1), audio_track(2)];
                    request.audio_metadata = audio_metadata.clone();
                    request.resolution = ResolutionSelection {
                        width: 32,
                        height: 32,
                    };
                    build_optimized_arguments(&source_media, &request, &source_path, &output_path)
                        .expect("Optimized Export arguments should be valid")
                };
                let exported = Command::new(&ffmpeg)
                    .args(arguments)
                    .output()
                    .expect("ffmpeg should launch");
                assert!(
                    exported.status.success(),
                    "{route} {container} export failed: {}",
                    String::from_utf8_lossy(&exported.stderr)
                );

                let probe = Command::new(&ffprobe)
                    .args([
                        "-v",
                        "error",
                        "-select_streams",
                        "a",
                        "-show_entries",
                        "stream_tags=language,title,name:stream_disposition=default",
                        "-of",
                        "json",
                    ])
                    .arg(&output_path)
                    .output()
                    .expect("ffprobe should launch");
                assert!(
                    probe.status.success(),
                    "ffprobe failed for {route} {container}"
                );
                let json: serde_json::Value =
                    serde_json::from_slice(&probe.stdout).expect("ffprobe output should be JSON");
                let streams = json["streams"]
                    .as_array()
                    .expect("audio streams should be present");
                assert_eq!(streams.len(), 2, "{route} {container} output order");
                assert_eq!(streams[0]["disposition"]["default"], 0);
                assert_eq!(streams[1]["disposition"]["default"], 1);
                assert_eq!(
                    streams[0]["tags"]["title"]
                        .as_str()
                        .or_else(|| streams[0]["tags"]["name"].as_str()),
                    Some("English commentary")
                );
                assert_eq!(streams[0]["tags"]["language"], "eng");
                assert_eq!(
                    streams[1]["tags"]["title"]
                        .as_str()
                        .or_else(|| streams[1]["tags"]["name"].as_str()),
                    Some("Source Russian")
                );
                assert_eq!(streams[1]["tags"]["language"], "rus");
            }
        }

        std::fs::remove_dir_all(directory).expect("temporary fixtures should be removed");
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
                audio_tracks: vec![audio_track(2)],
                audio_metadata: Vec::new(),
                merge_audio: false,
                chapters: None,
                rotation_degrees: 0,
                strip_metadata: false,
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
                audio_metadata: Vec::new(),
                merge_audio: false,
                chapters: None,
                rotation_degrees: 0,
                strip_metadata: false,
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
    fn stripping_metadata_and_chapters_keeps_fast_and_optimized_video_copy_modes() {
        let fast_arguments = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: Vec::new(),
                audio_metadata: Vec::new(),
                merge_audio: false,
                chapters: None,
                strip_metadata: true,
                rotation_degrees: 0,
            },
            Path::new("source.mkv"),
            Path::new("out.mkv"),
        )
        .expect("fast request is valid");
        let fast_values = fast_arguments
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        let mut optimized_request = optimized_request("-c:v libx264 -crf 20");
        optimized_request.strip_metadata = true;
        let optimized_arguments = build_optimized_arguments(
            &media(),
            &optimized_request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("optimized request is valid");
        let optimized_values = optimized_arguments
            .iter()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        for values in [&fast_values, &optimized_values] {
            assert!(
                values
                    .windows(2)
                    .any(|pair| pair == ["-map_metadata", "-1"])
            );
            assert!(
                values
                    .windows(2)
                    .any(|pair| pair == ["-map_chapters", "-1"])
            );
        }
        assert!(fast_values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
    }

    #[test]
    fn fast_export_rejects_rotation_instead_of_copying_untransformed_video() {
        let error = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: Vec::new(),
                audio_metadata: Vec::new(),
                merge_audio: false,
                chapters: None,
                rotation_degrees: 90,
                strip_metadata: false,
            },
            Path::new("source.mkv"),
            Path::new("out.mkv"),
        )
        .expect_err("fast export must not silently drop rotation");

        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn fast_merge_sums_tracks_without_track_count_normalization() {
        let args = build_fast_arguments(
            &media(),
            &FastExportRequest {
                source_path: "source.mkv".to_owned(),
                trim: TrimSelection {
                    start_micros: 0,
                    end_micros: 2_000_000,
                },
                audio_tracks: vec![audio_track(1), audio_track(2)],
                audio_metadata: Vec::new(),
                merge_audio: true,
                chapters: None,
                rotation_degrees: 0,
                strip_metadata: false,
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
            value.contains("amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]")
        }));
        assert!(values.iter().all(|value| !value.contains("normalize=1")));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
    }

    #[test]
    fn fast_export_applies_track_volume_only_to_selected_audio() {
        let mut request = fast_request(vec![audio_track(2)]);
        request.audio_tracks[0].volume = 2.0;
        let args = build_fast_arguments(
            &media(),
            &request,
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
                .any(|value| value == "[0:2]volume=2:precision=double[audio0]")
        );
        assert!(values.windows(2).any(|pair| pair == ["-map", "[audio0]"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(!values.iter().any(|value| value == "0:1"));
    }

    #[test]
    fn export_compiles_gain_and_normalization_in_chain_order_then_track_volume() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.audio_tracks.push(processed_track(
            2,
            vec![
                gain("pre", -3.0),
                normalization("norm", -16.0),
                gain("post", 2.0),
            ],
            vec![measurement("norm")],
            0.5,
        ));
        let graph = filter_graph(
            &build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect("request is valid"),
        );

        assert!(graph.contains("[0:1]anull[audio0]"));
        assert!(graph.contains(
            "[0:2]aresample=48000:async=1:first_pts=0,volume=-3dB:precision=double,volume=4dB:precision=double,volume=2dB:precision=double,volume=0.5:precision=double[audio1]"
        ));
    }

    #[test]
    fn track_volume_follows_every_filter_before_merging() {
        let tracks = [
            processed_track(
                2,
                vec![gain("g", 6.0), limiter("lim", -1.0)],
                Vec::new(),
                0.25,
            ),
            processed_track(4, vec![limiter("lim", -2.0)], Vec::new(), 3.0),
        ];
        let graph = audio_filter_graph(&tracks, true).expect("chains compile");

        assert!(graph.contains(
            "[0:2]aresample=48000:async=1:first_pts=0,volume=6dB:precision=double,alimiter=limit=0.891251:attack=5:release=50:level=0:latency=1,volume=0.25:precision=double[audio0]"
        ));
        assert!(graph.contains(
            "alimiter=limit=0.794328:attack=5:release=50:level=0:latency=1,volume=3:precision=double[audio1]"
        ));
        assert!(graph.ends_with(
            "[audio0][audio1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]"
        ));
    }

    #[test]
    fn every_output_route_uses_the_same_compiled_chain() {
        let track = processed_track(
            1,
            vec![
                noise_reduction("nr"),
                high_pass("hp", 100.0),
                limiter("lim", -1.0),
            ],
            Vec::new(),
            1.0,
        );
        let expected = "[0:1]aresample=48000:async=1:first_pts=0,apad=pad_len=1200,afftdn=nr=12:nf=-35,atrim=start_sample=1200,asetpts=PTS-STARTPTS,highpass=f=100,alimiter=limit=0.891251:attack=5:release=50:level=0:latency=1[audio0]";
        let fast = filter_graph(
            &build_fast_arguments(
                &media(),
                &fast_request(vec![track.clone()]),
                Path::new("source.mkv"),
                Path::new("out.mkv"),
            )
            .unwrap(),
        );
        let mut optimized = optimized_request("-c:v libx264 -crf 20");
        optimized.audio_tracks = vec![track.clone()];
        let optimized = filter_graph(
            &build_optimized_arguments(
                &media(),
                &optimized,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .unwrap(),
        );
        let mut audio = audio_request(AudioExportFormat::M4a, false);
        audio.audio_tracks = vec![track];
        let audio = filter_graph(
            &build_audio_arguments(
                &media(),
                &audio,
                Path::new("source.mkv"),
                Path::new("out.m4a"),
            )
            .unwrap(),
        );
        assert_eq!(fast, expected);
        assert_eq!(optimized, expected);
        assert_eq!(audio, expected);
    }

    #[test]
    fn export_rejects_invalid_volume_parameters_and_measurements() {
        let invalid_tracks = [
            processed_track(1, Vec::new(), Vec::new(), f64::NAN),
            processed_track(1, Vec::new(), Vec::new(), 5.5),
            processed_track(1, vec![high_pass("hp", 5.0)], Vec::new(), 1.0),
            processed_track(1, vec![normalization("norm", -16.0)], Vec::new(), 1.0),
            processed_track(1, vec![gain("dup", 1.0), gain("dup", 2.0)], Vec::new(), 1.0),
            processed_track(
                1,
                vec![normalization("norm", -16.0)],
                vec![FilterMeasurement {
                    filter_id: "norm".to_owned(),
                    analysis: AudioLoudnessAnalysis {
                        input_lra: Some(f64::NAN),
                        input_threshold: Some(-30.0),
                        integrated_lufs: Some(-20.0),
                        true_peak_db: Some(-5.0),
                    },
                }],
                1.0,
            ),
        ];
        for track in invalid_tracks {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.audio_tracks = vec![track];
            let error = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect_err("invalid processing must not reach FFmpeg");
            assert_eq!(error.code, "invalid_request");
        }
    }

    #[test]
    fn fast_export_reencodes_when_only_track_normalization_is_enabled() {
        let track = processed_track(
            1,
            vec![normalization("norm", -14.0)],
            vec![measurement("norm")],
            1.0,
        );
        let args = build_fast_arguments(
            &media(),
            &fast_request(vec![track]),
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
        assert!(values.iter().any(|value| {
            value.contains(
                "[0:1]aresample=48000:async=1:first_pts=0,volume=6dB:precision=double[audio0]",
            )
        }));
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
                audio_tracks: vec![audio_track(1)],
                audio_metadata: Vec::new(),
                merge_audio: false,
                chapters: None,
                rotation_degrees: 0,
                strip_metadata: false,
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
    fn stripping_metadata_rejects_custom_global_metadata_assignments() {
        for arguments in [
            "-c:v libx264 -metadata title=private",
            "-c:v libx264 -metadata=title=private",
            "-c:v libx264 -metadata:g title=private",
        ] {
            let mut request = optimized_request(arguments);
            request.strip_metadata = true;

            let error = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect_err("global metadata assignments must not bypass metadata stripping");

            assert_eq!(
                error.message_id,
                AppErrorMessageId::ExportGlobalMetadataCannotBeSetWhenStrippingMetadata,
                "arguments: {arguments}"
            );
        }

        let mut stream_metadata_request =
            optimized_request("-c:v libx264 -metadata:s:a:0 title=custom-audio-title");
        stream_metadata_request.strip_metadata = true;
        let stream_metadata_arguments = build_optimized_arguments(
            &media(),
            &stream_metadata_request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect("stream-scoped metadata remains available when stripping global metadata");
        assert!(
            stream_metadata_arguments.windows(2).any(|pair| {
                pair[0] == "-metadata:s:a:0" && pair[1] == "title=custom-audio-title"
            })
        );
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
    fn gif_preview_uses_the_execution_builder_for_the_complete_command() {
        let request = GifExportRequest {
            source_path: "private-source.mkv".to_owned(),
            trim: TrimSelection {
                start_micros: 1_250_000,
                end_micros: 4_750_000,
            },
            audio_tracks: Vec::new(),
            merge_audio: false,
            rotation_degrees: 90,
            crop: Some(CropSelection {
                x: 0.1,
                y: 0.2,
                width: 0.7,
                height: 0.6,
            }),
            flip_horizontal: true,
            flip_vertical: true,
            resolution: ResolutionSelection {
                width: 640,
                height: 480,
            },
            frame_rate: Some(FrameRateSelection {
                numerator: 24,
                denominator: 1,
            }),
            gif_preset: GifPreset::Balanced,
            palette_colors: 256,
            palette_stats_mode: GifPaletteStatsMode::Diff,
            dithering: GifDithering::Sierra2_4a,
        };

        let preview = gif_command_preview(&media(), &request).expect("preview request is valid");
        let execution_arguments = build_gif_arguments(
            &media(),
            &request,
            Path::new("<source>"),
            Path::new("<output>"),
        )
        .expect("execution request is valid");
        let expected = std::iter::once(std::ffi::OsString::from("ffmpeg"))
            .chain(execution_arguments)
            .map(|argument| super::quote_preview_argument(&argument))
            .collect::<Vec<_>>()
            .join(" ");

        assert_eq!(preview, expected);
        assert!(preview.contains("-ss 1.250000 -i <source> -t 3.500000"));
        assert!(preview.contains("transpose=1,crop=iw*0.7:ih*0.6:iw*0.1:ih*0.2,hflip,vflip,fps=24/1,scale=w='min(640,480*dar)':h='min(480,640/dar)':eval=init:flags=lanczos,setsar=1"));
        assert!(preview.contains("palettegen=max_colors=256:stats_mode=diff"));
        assert!(preview.contains("paletteuse=dither=sierra2_4a"));
        assert!(preview.contains("-loop 0 -f gif -y <output>"));
        assert!(!preview.contains("private-source.mkv"));

        let mut source_frame_rate_request = request.clone();
        source_frame_rate_request.frame_rate = None;
        let source_frame_rate_preview = gif_command_preview(&media(), &source_frame_rate_request)
            .expect("source frame rate request is valid");
        assert!(!source_frame_rate_preview.contains("fps="));

        let mut invalid_frame_rate_request = request;
        invalid_frame_rate_request.frame_rate = Some(FrameRateSelection {
            numerator: 0,
            denominator: 1,
        });
        assert_eq!(
            gif_command_preview(&media(), &invalid_frame_rate_request)
                .expect_err("invalid frame rate should fail planning")
                .message_id,
            crate::error::AppErrorMessageId::ExportOutputFrameRateIsInvalid,
        );
    }

    #[test]
    fn gif_arguments_apply_trim_transforms_scaling_palette_and_video_only_output() {
        let arguments = build_gif_arguments(
            &media(),
            &gif_request(),
            Path::new("source.mkv"),
            Path::new("out.gif"),
        )
        .expect("GIF request is valid")
        .into_iter()
        .map(|argument| argument.to_string_lossy().to_string())
        .collect::<Vec<_>>();
        let filter = arguments
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .map(|pair| pair[1].as_str())
            .expect("filter graph is present");

        assert!(arguments.windows(2).any(|pair| pair == ["-ss", "1.250000"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-t", "3.500000"]));
        assert!(filter.contains(
            "transpose=1,crop=iw*0.7:ih*0.6:iw*0.1:ih*0.2,hflip,vflip,fps=24/1,scale=w='min(640,480*dar)':h='min(480,640/dar)':eval=init:flags=lanczos,setsar=1"
        ));
        assert!(filter.contains("[v1]palettegen=max_colors=256:stats_mode=diff[palette]"));
        assert!(filter.contains("[v2][palette]paletteuse=dither=sierra2_4a[out]"));
        assert!(arguments.windows(2).any(|pair| pair == ["-map", "[out]"]));
        assert!(arguments.contains(&"-an".to_owned()));
        assert!(!arguments.iter().any(|argument| argument == "0:a"));
        assert!(arguments.windows(2).any(|pair| pair == ["-loop", "0"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-f", "gif"]));
    }

    #[test]
    fn gif_arguments_apply_each_palette_and_dithering_option() {
        for palette_colors in [16, 32, 64, 128, 256] {
            for (dithering, ffmpeg_dithering) in [
                (GifDithering::None, "none"),
                (GifDithering::Bayer, "bayer"),
                (GifDithering::Sierra2_4a, "sierra2_4a"),
            ] {
                let mut request = gif_request();
                request.palette_colors = palette_colors;
                request.dithering = dithering;
                request.palette_stats_mode = GifPaletteStatsMode::Full;
                let arguments = build_gif_arguments(
                    &media(),
                    &request,
                    Path::new("source.mkv"),
                    Path::new("out.gif"),
                )
                .expect("GIF settings are valid");
                let filter = arguments
                    .windows(2)
                    .find(|pair| pair[0] == "-filter_complex")
                    .map(|pair| pair[1].to_string_lossy())
                    .expect("filter graph is present");
                assert!(filter.contains(&format!(
                    "palettegen=max_colors={palette_colors}:stats_mode=full[palette]"
                )));
                assert!(filter.contains(&format!("paletteuse=dither={ffmpeg_dithering}[out]")));
            }
        }
    }

    #[test]
    fn gif_arguments_reject_unsupported_palette_sizes() {
        let mut request = gif_request();
        request.palette_colors = 96;
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportGifEncodingSettingsAreInvalid
        );
    }

    #[test]
    fn gif_request_defaults_new_encoding_fields_for_legacy_requests() {
        let request = serde_json::from_str::<GifExportRequest>(
            r#"{
                "sourcePath":"source.mkv",
                "trim":{"startMicros":0,"endMicros":1000000},
                "audioTracks":[],
                "mergeAudio":false,
                "rotationDegrees":0,
                "crop":null,
                "flipHorizontal":false,
                "flipVertical":false,
                "resolution":{"width":640,"height":360},
                "frameRate":null
            }"#,
        )
        .expect("legacy GIF request remains valid");

        assert_eq!(request.gif_preset, GifPreset::Balanced);
        assert_eq!(request.palette_colors, 256);
        assert_eq!(request.palette_stats_mode, GifPaletteStatsMode::Diff);
        assert_eq!(request.dithering, GifDithering::Sierra2_4a);
    }

    #[test]
    fn gif_settings_reject_invalid_trim_crop_rotation_resolution_frame_rate_and_audio() {
        let mut request = gif_request();
        request.trim.end_micros = request.trim.start_micros;
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportSelectedExportRangeIsInvalid
        );

        let mut request = gif_request();
        request.crop = Some(CropSelection {
            x: 0.5,
            y: 0.0,
            width: 0.51,
            height: 1.0,
        });
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportCropSelectionIsInvalid
        );

        let mut request = gif_request();
        request.rotation_degrees = 45;
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportRotationMustBe090180Or270Degrees
        );

        let mut request = gif_request();
        request.resolution.width = 0;
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportOutputResolutionMustBeGreaterThanZero
        );

        let mut request = gif_request();
        request.frame_rate = Some(FrameRateSelection {
            numerator: 240,
            denominator: 1,
        });
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportOutputFrameRateIsInvalid
        );

        let mut request = gif_request();
        request.merge_audio = true;
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid
        );

        let mut request = gif_request();
        request.audio_tracks.push(audio_track(1));
        assert_eq!(
            gif_error_id(&request),
            crate::error::AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid
        );
    }

    #[test]
    fn gif_crop_at_source_edge_preserves_transform_order_for_display_aspect_scaling() {
        let mut source = media();
        source.video.width = 720;
        source.video.height = 576;
        source.video.sample_aspect_ratio = Some("16:15".to_owned());
        let mut request = gif_request();
        request.rotation_degrees = 270;
        request.crop = Some(CropSelection {
            x: 0.5,
            y: 0.0,
            width: 0.5,
            height: 1.0,
        });
        request.resolution = ResolutionSelection {
            width: 480,
            height: 480,
        };

        let arguments = build_gif_arguments(
            &source,
            &request,
            Path::new("source.mkv"),
            Path::new("out.gif"),
        )
        .expect("edge-aligned crop is valid")
        .into_iter()
        .map(|argument| argument.to_string_lossy().to_string())
        .collect::<Vec<_>>();
        let filter = arguments
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .map(|pair| pair[1].as_str())
            .expect("filter graph is present");

        assert!(filter.contains("transpose=2,crop=iw*0.5:ih*1:iw*0.5:ih*0,hflip,vflip,"));
        assert!(filter.contains("scale=w='min(480,480*dar)':h='min(480,480/dar)'"));
        assert!(filter.contains(
            "scale=w='min(480,480*dar)':h='min(480,480/dar)':eval=init:flags=lanczos,setsar=1,split"
        ));
    }

    #[test]
    fn gif_scaling_preserves_display_aspect_for_anamorphic_sources() {
        let mut source = media();
        source.video.width = 720;
        source.video.height = 576;
        source.video.sample_aspect_ratio = Some("16:15".to_owned());
        let request = GifExportRequest {
            source_path: "source.mkv".to_owned(),
            trim: TrimSelection {
                start_micros: 0,
                end_micros: 1_000_000,
            },
            audio_tracks: Vec::new(),
            merge_audio: false,
            rotation_degrees: 0,
            crop: None,
            flip_horizontal: false,
            flip_vertical: false,
            resolution: ResolutionSelection {
                width: 480,
                height: 384,
            },
            frame_rate: None,
            gif_preset: GifPreset::Balanced,
            palette_colors: 256,
            palette_stats_mode: GifPaletteStatsMode::Diff,
            dithering: GifDithering::Sierra2_4a,
        };

        let arguments = build_gif_arguments(
            &source,
            &request,
            Path::new("<source>"),
            Path::new("<output>"),
        )
        .expect("anamorphic GIF request is valid");
        let preview = gif_command_preview(&source, &request).expect("preview is valid");
        let expected_scale =
            "scale=w='min(480,384*dar)':h='min(384,480/dar)':eval=init:flags=lanczos,setsar=1";

        assert!(
            arguments
                .iter()
                .any(|argument| argument.to_string_lossy().contains(expected_scale))
        );
        assert!(preview.contains(expected_scale));

        let mut transformed_request = request;
        transformed_request.rotation_degrees = 90;
        transformed_request.crop = Some(CropSelection {
            x: 0.1,
            y: 0.2,
            width: 0.7,
            height: 0.6,
        });
        let transformed_arguments = build_gif_arguments(
            &source,
            &transformed_request,
            Path::new("<source>"),
            Path::new("<output>"),
        )
        .expect("transformed anamorphic GIF request is valid");
        assert!(transformed_arguments.iter().any(|argument| {
            argument.to_string_lossy().contains(
                "transpose=1,crop=iw*0.7:ih*0.6:iw*0.1:ih*0.2,scale=w='min(480,384*dar)':h='min(384,480/dar)'",
            )
        }));
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
