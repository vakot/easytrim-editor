use std::{
    cmp::Ordering,
    collections::HashSet,
    ffi::OsString,
    hash::{DefaultHasher, Hash, Hasher},
    path::Path,
};

use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, AppErrorMessageId},
    media::probe::MediaInfo,
};

const MICROS_PER_SECOND: f64 = 1_000_000.0;

// Keep stage/type ordering in sync with audio-processing.ts.
const HIGH_PASS_SIGNAL_EFFECT_ORDER: u8 = 0;
const NOISE_REDUCTION_SIGNAL_EFFECT_ORDER: u8 = 1;
const LIMITER_SIGNAL_EFFECT_ORDER: u8 = 2;

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

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AudioExportFormat {
    M4a,
    Wav,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioExportRequest {
    pub source_path: String,
    pub trim: TrimSelection,
    pub audio_tracks: Vec<AudioTrackSelection>,
    pub merge_audio: bool,
    pub format: AudioExportFormat,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackSelection {
    #[serde(default)]
    pub loudness_analysis: Option<AudioLoudnessAnalysis>,
    pub stream_index: u32,
    pub processing: AudioTrackProcessing,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioLoudnessAnalysis {
    pub input_lra: Option<f64>,
    pub input_threshold: Option<f64>,
    pub integrated_lufs: Option<f64>,
    pub true_peak_db: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackProcessing {
    pub gain_db: f64,
    #[serde(default)]
    pub loudness_normalization: Option<LoudnessNormalization>,
    #[serde(default)]
    pub effects: Vec<AudioTrackSignalEffect>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AudioTrackSignalEffect {
    HighPass {
        cutoff_hz: f64,
        stage: AudioProcessingStage,
    },
    NoiseReduction {
        preset: NoiseReductionPreset,
        stage: AudioProcessingStage,
    },
    Limiter {
        ceiling_db: f64,
        stage: AudioProcessingStage,
    },
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NoiseReductionPreset {
    Light,
    Medium,
    Strong,
}

impl NoiseReductionPreset {
    fn filter(self) -> &'static str {
        // A fixed floor keeps stationary room noise from being learned and preserved as signal.
        match self {
            Self::Light => "afftdn=nr=6:nf=-40",
            Self::Medium => "afftdn=nr=12:nf=-35",
            Self::Strong => "afftdn=nr=20:nf=-30",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioProcessingStage {
    Cleanup,
    Dynamics,
    LevelPolicy,
    FinalProtection,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct AudioTrackCacheKey {
    pub stream_index: u32,
    gain_db_bits: u64,
    pub loudness_normalization: Option<LoudnessNormalizationCacheKey>,
    loudness_integrated_bits: Option<u64>,
    loudness_peak_bits: Option<u64>,
    loudness_lra_bits: Option<u64>,
    loudness_threshold_bits: Option<u64>,
    effects_hash: u64,
}

impl From<&AudioTrackSelection> for AudioTrackCacheKey {
    fn from(track: &AudioTrackSelection) -> Self {
        let mut ordered_effects = track.processing.effects.iter().collect::<Vec<_>>();
        ordered_effects.sort_by(|left, right| compare_signal_effects(left, right));
        let effects = ordered_effects
            .into_iter()
            .map(|effect| match effect {
                AudioTrackSignalEffect::HighPass { cutoff_hz, stage } => {
                    (*stage, 0_u8, cutoff_hz.to_bits())
                }
                AudioTrackSignalEffect::NoiseReduction { preset, stage } => {
                    let value = match preset {
                        NoiseReductionPreset::Light => 1,
                        NoiseReductionPreset::Medium => 2,
                        NoiseReductionPreset::Strong => 3,
                    };
                    (*stage, 1, value)
                }
                AudioTrackSignalEffect::Limiter { ceiling_db, stage } => {
                    (*stage, 2, ceiling_db.to_bits())
                }
            })
            .collect::<Vec<_>>();
        let mut effects_hasher = DefaultHasher::new();
        effects.hash(&mut effects_hasher);

        Self {
            stream_index: track.stream_index,
            gain_db_bits: if track.processing.loudness_normalization.is_some()
                || track.processing.gain_db == 0.0
            {
                0.0_f64.to_bits()
            } else {
                track.processing.gain_db.to_bits()
            },
            loudness_normalization: track
                .processing
                .loudness_normalization
                .as_ref()
                .map(LoudnessNormalizationCacheKey::from),
            loudness_integrated_bits: track
                .loudness_analysis
                .and_then(|analysis| analysis.integrated_lufs)
                .map(f64::to_bits),
            loudness_peak_bits: track
                .loudness_analysis
                .and_then(|analysis| analysis.true_peak_db)
                .map(f64::to_bits),
            loudness_lra_bits: track
                .loudness_analysis
                .and_then(|analysis| analysis.input_lra)
                .map(f64::to_bits),
            loudness_threshold_bits: track
                .loudness_analysis
                .and_then(|analysis| analysis.input_threshold)
                .map(f64::to_bits),
            effects_hash: effects_hasher.finish(),
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
            AppErrorMessageId::ExportFastExportCannotApplyRotationUseOptimizedExport,
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

pub fn build_audio_arguments(
    source: &MediaInfo,
    request: &AudioExportRequest,
    source_path: &Path,
    output_path: &Path,
) -> Result<Vec<OsString>, AppError> {
    validate_common_request(source, &request.trim, &request.audio_tracks)?;
    if request.audio_tracks.is_empty() {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportAudioTrackIsRequired,
        ));
    }
    if request.format == AudioExportFormat::Wav
        && request.audio_tracks.len() > 1
        && !request.merge_audio
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportWavRequiresMergedAudioTracks,
        ));
    }

    let mut arguments = common_input_arguments(source_path, &request.trim);
    let merge = request.merge_audio && request.audio_tracks.len() > 1;
    if merge {
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
    arguments.extend([
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
    ]);
    match request.format {
        AudioExportFormat::M4a => {
            arguments.extend([
                OsString::from("-c:a"),
                OsString::from("aac"),
                OsString::from("-b:a"),
                OsString::from("192k"),
                OsString::from("-f"),
                OsString::from("ipod"),
            ]);
        }
        AudioExportFormat::Wav => {
            arguments.extend([OsString::from("-c:a"), OsString::from("pcm_s16le")]);
        }
    }
    arguments.extend([OsString::from("-y"), output_path.as_os_str().to_owned()]);
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
            AppErrorMessageId::ExportOutputFrameRateIsInvalid,
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
    validate_trim_selection(source, trim)?;
    validate_audio_track_selections(source, audio_tracks)
}

pub(crate) fn validate_loudness_analysis_request(
    source: &MediaInfo,
    trim: &TrimSelection,
    audio_track: &AudioTrackSelection,
) -> Result<(), AppError> {
    validate_trim_selection(source, trim)?;
    validate_audio_track_selections_inner(source, std::slice::from_ref(audio_track), false)
}

fn validate_trim_selection(source: &MediaInfo, trim: &TrimSelection) -> Result<(), AppError> {
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

pub(crate) fn validate_audio_track_selections(
    source: &MediaInfo,
    audio_tracks: &[AudioTrackSelection],
) -> Result<(), AppError> {
    validate_audio_track_selections_inner(source, audio_tracks, true)
}

fn validate_audio_track_selections_inner(
    source: &MediaInfo,
    audio_tracks: &[AudioTrackSelection],
    require_loudness_analysis: bool,
) -> Result<(), AppError> {
    let mut selected_streams = HashSet::new();
    for track in audio_tracks {
        let mut high_pass_stages = HashSet::new();
        let mut has_noise_reduction = false;
        let mut has_limiter = false;
        let is_known_stream = source
            .audio_streams
            .iter()
            .any(|stream| stream.stream_index == track.stream_index);
        if !track.processing.gain_db.is_finite()
            || track.processing.effects.iter().any(|effect| {
                let valid = match effect {
                    AudioTrackSignalEffect::HighPass { cutoff_hz, stage } => {
                        *stage != AudioProcessingStage::LevelPolicy
                            && cutoff_hz.is_finite()
                            && (10.0..=20_000.0).contains(cutoff_hz)
                    }
                    AudioTrackSignalEffect::NoiseReduction { stage, .. } => {
                        *stage == AudioProcessingStage::Cleanup
                    }
                    AudioTrackSignalEffect::Limiter { ceiling_db, stage } => {
                        *stage == AudioProcessingStage::FinalProtection
                            && ceiling_db.is_finite()
                            && (-24.0..=0.0).contains(ceiling_db)
                    }
                };
                let duplicate_effect = match effect {
                    AudioTrackSignalEffect::HighPass { stage, .. } => {
                        !high_pass_stages.insert(*stage)
                    }
                    AudioTrackSignalEffect::NoiseReduction { .. } => {
                        std::mem::replace(&mut has_noise_reduction, true)
                    }
                    AudioTrackSignalEffect::Limiter { .. } => {
                        std::mem::replace(&mut has_limiter, true)
                    }
                };
                !valid || duplicate_effect
            })
            || track.loudness_analysis.is_some_and(|analysis| {
                analysis
                    .integrated_lufs
                    .is_some_and(|value| !value.is_finite())
                    || analysis
                        .true_peak_db
                        .is_some_and(|value| !value.is_finite())
                    || analysis.input_lra.is_some_and(|value| !value.is_finite())
                    || analysis
                        .input_threshold
                        .is_some_and(|value| !value.is_finite())
            })
            || (require_loudness_analysis
                && track.processing.loudness_normalization.is_some()
                && track.loudness_analysis.is_none())
            || !is_known_stream
            || !selected_streams.insert(track.stream_index)
            || !is_valid_loudness_normalization(track.processing.loudness_normalization.as_ref())
        {
            return Err(AppError::invalid_request(
                AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
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
    audio_tracks.iter().any(|track| {
        track.processing.gain_db != 0.0
            || track.processing.loudness_normalization.is_some()
            || !track.processing.effects.is_empty()
    })
}

pub(crate) fn pre_level_filter_chain(processing: &AudioTrackProcessing) -> String {
    ordered_signal_effects(processing)
        .into_iter()
        .filter_map(|effect| match effect {
            AudioTrackSignalEffect::HighPass { cutoff_hz, stage }
                if matches!(
                    stage,
                    AudioProcessingStage::Cleanup | AudioProcessingStage::Dynamics
                ) =>
            {
                Some(format!("highpass=f={cutoff_hz:.3}"))
            }
            AudioTrackSignalEffect::HighPass { .. } => None,
            AudioTrackSignalEffect::NoiseReduction { preset, stage }
                if matches!(
                    stage,
                    AudioProcessingStage::Cleanup | AudioProcessingStage::Dynamics
                ) =>
            {
                Some(preset.filter().to_owned())
            }
            AudioTrackSignalEffect::NoiseReduction { .. } => None,
            AudioTrackSignalEffect::Limiter { .. } => None,
        })
        .collect::<Vec<_>>()
        .join(",")
}

pub(crate) fn waveform_signal_filter_chain(processing: &AudioTrackProcessing) -> String {
    pre_level_filter_chain(processing)
}

fn final_protection_filter_chain(processing: &AudioTrackProcessing) -> String {
    ordered_signal_effects(processing)
        .into_iter()
        .filter_map(|effect| match effect {
            AudioTrackSignalEffect::HighPass {
                cutoff_hz,
                stage: AudioProcessingStage::FinalProtection,
            } => Some(format!("highpass=f={cutoff_hz:.3}")),
            AudioTrackSignalEffect::Limiter { ceiling_db, .. } => {
                let limit = 10.0_f64.powf(ceiling_db / 20.0);
                Some(format!(
                    "alimiter=limit={limit:.6}:attack=5:release=50:level=0:latency=1"
                ))
            }
            AudioTrackSignalEffect::HighPass { .. } => None,
            AudioTrackSignalEffect::NoiseReduction { .. } => None,
        })
        .collect::<Vec<_>>()
        .join(",")
}

fn ordered_signal_effects(processing: &AudioTrackProcessing) -> Vec<&AudioTrackSignalEffect> {
    let mut effects = processing.effects.iter().collect::<Vec<_>>();
    effects.sort_by(|left, right| compare_signal_effects(left, right));
    effects
}

fn compare_signal_effects(
    left: &AudioTrackSignalEffect,
    right: &AudioTrackSignalEffect,
) -> Ordering {
    signal_effect_stage_order(left)
        .cmp(&signal_effect_stage_order(right))
        .then_with(|| signal_effect_type_order(left).cmp(&signal_effect_type_order(right)))
        .then_with(|| match (left, right) {
            (
                AudioTrackSignalEffect::HighPass {
                    cutoff_hz: left, ..
                },
                AudioTrackSignalEffect::HighPass {
                    cutoff_hz: right, ..
                },
            ) => left.total_cmp(right),
            (
                AudioTrackSignalEffect::NoiseReduction { preset: left, .. },
                AudioTrackSignalEffect::NoiseReduction { preset: right, .. },
            ) => noise_reduction_preset_order(left).cmp(&noise_reduction_preset_order(right)),
            (
                AudioTrackSignalEffect::Limiter {
                    ceiling_db: left, ..
                },
                AudioTrackSignalEffect::Limiter {
                    ceiling_db: right, ..
                },
            ) => left.total_cmp(right),
            _ => Ordering::Equal,
        })
}

fn signal_effect_stage_order(effect: &AudioTrackSignalEffect) -> u8 {
    match effect_stage(effect) {
        AudioProcessingStage::Cleanup => 0,
        AudioProcessingStage::Dynamics => 1,
        AudioProcessingStage::LevelPolicy => 2,
        AudioProcessingStage::FinalProtection => 3,
    }
}

fn effect_stage(effect: &AudioTrackSignalEffect) -> AudioProcessingStage {
    match effect {
        AudioTrackSignalEffect::HighPass { stage, .. }
        | AudioTrackSignalEffect::NoiseReduction { stage, .. }
        | AudioTrackSignalEffect::Limiter { stage, .. } => *stage,
    }
}

fn signal_effect_type_order(effect: &AudioTrackSignalEffect) -> u8 {
    match effect {
        AudioTrackSignalEffect::HighPass { .. } => HIGH_PASS_SIGNAL_EFFECT_ORDER,
        AudioTrackSignalEffect::NoiseReduction { .. } => NOISE_REDUCTION_SIGNAL_EFFECT_ORDER,
        AudioTrackSignalEffect::Limiter { .. } => LIMITER_SIGNAL_EFFECT_ORDER,
    }
}

fn noise_reduction_preset_order(preset: &NoiseReductionPreset) -> u8 {
    match preset {
        NoiseReductionPreset::Light => 0,
        NoiseReductionPreset::Medium => 1,
        NoiseReductionPreset::Strong => 2,
    }
}

pub(crate) fn audio_filter_graph(audio_tracks: &[AudioTrackSelection], merge: bool) -> String {
    // Manual gain and normalization are mutually exclusive level policies.
    let mut graph = audio_tracks
        .iter()
        .enumerate()
        .map(|(index, track)| {
            let mut filters = format!("[0:{}]", track.stream_index);
            if let Some(normalization) = track.processing.loudness_normalization.as_ref() {
                let (integrated_lufs, true_peak_db) = normalization.targets();
                let analysis = track
                    .loudness_analysis
                    .expect("normalized audio tracks require a loudness measurement");
                filters.push_str(&normalization_filter(
                    &track.processing,
                    analysis,
                    integrated_lufs,
                    true_peak_db,
                    index,
                ));
            } else {
                let pre_level_filters = pre_level_filter_chain(&track.processing);
                if !pre_level_filters.is_empty() {
                    filters.push_str(&pre_level_filters);
                    filters.push(',');
                }
                filters.push_str(&format!("volume={:.6}dB", track.processing.gain_db));
                let final_protection_filters = final_protection_filter_chain(&track.processing);
                if !final_protection_filters.is_empty() {
                    filters.push(',');
                    filters.push_str(&final_protection_filters);
                }
                filters.push_str(&format!("[audio{index}]"));
            }
            filters
        })
        .collect::<Vec<_>>();
    if merge {
        let inputs = (0..audio_tracks.len())
            .map(|index| format!("[audio{index}]"))
            .collect::<String>();
        graph.push(format!(
            "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
            audio_tracks.len()
        ));
    }
    graph.join(";")
}

fn normalization_filter(
    processing: &AudioTrackProcessing,
    analysis: AudioLoudnessAnalysis,
    target_lufs: f64,
    max_true_peak_db: f64,
    index: usize,
) -> String {
    let measured_pass = match (
        analysis.integrated_lufs,
        analysis.true_peak_db,
        analysis.input_lra,
        analysis.input_threshold,
    ) {
        (Some(input_i), Some(input_tp), Some(input_lra), Some(input_thresh)) => {
            format!(
                ":measured_I={input_i:.6}:measured_TP={input_tp:.6}:measured_LRA={input_lra:.6}:measured_thresh={input_thresh:.6}:linear=true"
            )
        }
        _ => String::new(),
    };
    // loudnorm may upsample internally; keep every normalized output on the app's 48 kHz policy.
    let pre_level_filters = pre_level_filter_chain(processing);
    let final_protection_filters = final_protection_filter_chain(processing);
    format!(
        "{pre_level_filters}{pre_level_comma}loudnorm=I={target_lufs:.3}:TP={max_true_peak_db:.3}:LRA=11{measured_pass},aresample=48000{final_protection_comma}{final_protection_filters}[audio{index}]",
        pre_level_comma = if pre_level_filters.is_empty() {
            ""
        } else {
            ","
        },
        final_protection_comma = if final_protection_filters.is_empty() {
            ""
        } else {
            ","
        },
    )
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

    use super::{
        AudioExportFormat, AudioExportRequest, AudioLoudnessAnalysis, AudioProcessingStage,
        AudioTrackCacheKey, AudioTrackProcessing, AudioTrackSelection, AudioTrackSignalEffect,
        CropSelection, FastExportRequest, FrameRateSelection, LoudnessNormalization,
        LoudnessPreset, NoiseReductionPreset, OptimizedExportRequest, ResolutionSelection,
        TrimSelection, audio_filter_graph, build_audio_arguments, build_fast_arguments,
        build_optimized_arguments, optimized_command_preview, pre_level_filter_chain,
        validate_audio_track_selections, waveform_signal_filter_chain,
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
                loudness_analysis: None,
                stream_index: 1,
                processing: AudioTrackProcessing {
                    gain_db: 0.0,
                    loudness_normalization: None,
                    effects: Vec::new(),
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

    fn audio_request(format: AudioExportFormat, merge_audio: bool) -> AudioExportRequest {
        let optimized = optimized_request("");
        AudioExportRequest {
            source_path: optimized.source_path,
            trim: optimized.trim,
            audio_tracks: optimized.audio_tracks,
            merge_audio,
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
    fn audio_export_merges_selected_tracks_for_wav() {
        let mut request = audio_request(AudioExportFormat::Wav, true);
        request.audio_tracks.push(AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects: Vec::new(),
            },
        });
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
        assert!(!values.windows(2).any(|pair| pair == ["-map", "0:1"]));
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
                    loudness_analysis: None,
                    stream_index: 2,
                    processing: AudioTrackProcessing {
                        gain_db: 0.0,
                        loudness_normalization: None,
                        effects: Vec::new(),
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
                merge_audio: false,
                rotation_degrees: 90,
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
                audio_tracks: vec![
                    AudioTrackSelection {
                        loudness_analysis: None,
                        stream_index: 1,
                        processing: AudioTrackProcessing {
                            gain_db: 0.0,
                            loudness_normalization: None,
                            effects: Vec::new(),
                        },
                    },
                    AudioTrackSelection {
                        loudness_analysis: None,
                        stream_index: 2,
                        processing: AudioTrackProcessing {
                            gain_db: 0.0,
                            loudness_normalization: None,
                            effects: Vec::new(),
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
            value.contains("amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]")
        }));
        assert!(values.iter().all(|value| !value.contains("normalize=1")));
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
                    loudness_analysis: None,
                    stream_index: 2,
                    processing: AudioTrackProcessing {
                        gain_db: 6.0,
                        loudness_normalization: None,
                        effects: Vec::new(),
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
                .any(|value| value.contains("0:2]volume=6.000000dB[audio0]"))
        );
        assert!(values.windows(2).any(|pair| pair == ["-map", "[audio0]"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(values.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(!values.iter().any(|value| value == "0:1"));
    }

    #[test]
    fn optimized_export_uses_normalization_instead_of_manual_gain() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.merge_audio = false;
        request.audio_tracks.push(AudioTrackSelection {
            loudness_analysis: Some(AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            }),
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: -3.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Streaming,
                )),
                effects: Vec::new(),
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

        assert!(graph.contains("[0:1]volume=0.000000dB[audio0]"));
        assert!(graph.contains("[0:2]loudnorm=I=-16.000:TP=-1.500:LRA=11"));
        assert!(graph.contains(":measured_I=-20.000000:measured_TP=-5.000000"));
        assert!(graph.contains(
            ":measured_LRA=5.000000:measured_thresh=-30.000000:linear=true,aresample=48000[audio1]"
        ));
        assert!(!graph.contains("volume=-3.000000dB"));
        assert!(!graph.contains("volume=3.500000dB"));
        assert!(values.contains(&"[audio0]".to_owned()));
        assert!(values.contains(&"[audio1]".to_owned()));
    }

    #[test]
    fn dynamic_loudnorm_fallback_is_real_normalization_and_resamples_explicitly() {
        let graph = audio_filter_graph(
            &[AudioTrackSelection {
                loudness_analysis: Some(AudioLoudnessAnalysis {
                    integrated_lufs: Some(-20.0),
                    true_peak_db: Some(-1.0),
                    input_lra: None,
                    input_threshold: None,
                }),
                stream_index: 2,
                processing: AudioTrackProcessing {
                    gain_db: 8.0,
                    loudness_normalization: Some(LoudnessNormalization::Preset(
                        LoudnessPreset::Streaming,
                    )),
                    effects: Vec::new(),
                },
            }],
            false,
        );
        assert!(graph.contains("[0:2]loudnorm=I=-16.000:TP=-1.500:LRA=11,aresample=48000[audio0]"));
        assert!(!graph.contains("volume="));
    }

    #[test]
    fn normalized_activity_cache_key_ignores_dormant_manual_gain() {
        let processing = |gain_db| AudioTrackSelection {
            loudness_analysis: Some(AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            }),
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Streaming,
                )),
                effects: Vec::new(),
            },
        };
        assert_eq!(
            AudioTrackCacheKey::from(&processing(-12.0)),
            AudioTrackCacheKey::from(&processing(6.0))
        );
    }

    #[test]
    fn activity_cache_key_includes_every_loudness_measurement() {
        let selection = |input_lra, input_threshold| AudioTrackSelection {
            loudness_analysis: Some(AudioLoudnessAnalysis {
                input_lra: Some(input_lra),
                input_threshold: Some(input_threshold),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            }),
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Streaming,
                )),
                effects: Vec::new(),
            },
        };

        let base = AudioTrackCacheKey::from(&selection(5.0, -30.0));
        assert_ne!(base, AudioTrackCacheKey::from(&selection(4.0, -30.0)));
        assert_ne!(base, AudioTrackCacheKey::from(&selection(5.0, -29.0)));
    }

    #[test]
    fn activity_cache_key_includes_signal_effects_after_the_level_policy_stage() {
        let mut selection = AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects: Vec::new(),
            },
        };
        let without_effect = AudioTrackCacheKey::from(&selection);
        selection.processing.effects = vec![AudioTrackSignalEffect::HighPass {
            cutoff_hz: 120.0,
            stage: AudioProcessingStage::FinalProtection,
        }];
        assert_ne!(without_effect, AudioTrackCacheKey::from(&selection));
    }

    #[test]
    fn activity_cache_keys_differ_between_noise_reduction_presets() {
        let selection = |preset| AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects: vec![AudioTrackSignalEffect::NoiseReduction {
                    preset,
                    stage: AudioProcessingStage::Cleanup,
                }],
            },
        };

        assert_ne!(
            AudioTrackCacheKey::from(&selection(NoiseReductionPreset::Light)),
            AudioTrackCacheKey::from(&selection(NoiseReductionPreset::Medium)),
        );
        assert_ne!(
            AudioTrackCacheKey::from(&selection(NoiseReductionPreset::Medium)),
            AudioTrackCacheKey::from(&selection(NoiseReductionPreset::Strong)),
        );
    }

    #[test]
    fn noise_reduction_presets_build_the_expected_ffmpeg_filter() {
        for (preset, expected_filter) in [
            (NoiseReductionPreset::Light, "afftdn=nr=6:nf=-40"),
            (NoiseReductionPreset::Medium, "afftdn=nr=12:nf=-35"),
            (NoiseReductionPreset::Strong, "afftdn=nr=20:nf=-30"),
        ] {
            let processing = AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects: vec![AudioTrackSignalEffect::NoiseReduction {
                    preset,
                    stage: AudioProcessingStage::Cleanup,
                }],
            };

            assert_eq!(pre_level_filter_chain(&processing), expected_filter);
        }
    }

    #[test]
    fn signal_effect_chain_is_canonical_independent_of_edit_order() {
        let high_pass = AudioTrackSignalEffect::HighPass {
            cutoff_hz: 120.0,
            stage: AudioProcessingStage::Cleanup,
        };
        let noise_reduction = AudioTrackSignalEffect::NoiseReduction {
            preset: NoiseReductionPreset::Strong,
            stage: AudioProcessingStage::Cleanup,
        };
        let processing = |effects| AudioTrackProcessing {
            gain_db: 0.0,
            loudness_normalization: None,
            effects,
        };

        let high_pass_then_noise_reduction = pre_level_filter_chain(&processing(vec![
            high_pass.clone(),
            noise_reduction.clone(),
        ]));
        let noise_reduction_then_high_pass =
            pre_level_filter_chain(&processing(vec![noise_reduction, high_pass]));

        assert_eq!(
            high_pass_then_noise_reduction,
            "highpass=f=120.000,afftdn=nr=20:nf=-30"
        );
        assert_eq!(
            noise_reduction_then_high_pass,
            high_pass_then_noise_reduction
        );

        let selection = |effects| AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 2,
            processing: processing(effects),
        };
        assert_eq!(
            AudioTrackCacheKey::from(&selection(vec![
                AudioTrackSignalEffect::HighPass {
                    cutoff_hz: 120.0,
                    stage: AudioProcessingStage::Cleanup,
                },
                AudioTrackSignalEffect::NoiseReduction {
                    preset: NoiseReductionPreset::Strong,
                    stage: AudioProcessingStage::Cleanup,
                },
            ])),
            AudioTrackCacheKey::from(&selection(vec![
                AudioTrackSignalEffect::NoiseReduction {
                    preset: NoiseReductionPreset::Strong,
                    stage: AudioProcessingStage::Cleanup,
                },
                AudioTrackSignalEffect::HighPass {
                    cutoff_hz: 120.0,
                    stage: AudioProcessingStage::Cleanup,
                },
            ]))
        );
    }

    #[test]
    fn applies_each_tracks_limiter_after_its_level_policy_before_merging() {
        let tracks = [
            AudioTrackSelection {
                loudness_analysis: None,
                stream_index: 2,
                processing: AudioTrackProcessing {
                    gain_db: -3.0,
                    loudness_normalization: None,
                    effects: vec![AudioTrackSignalEffect::Limiter {
                        ceiling_db: -1.0,
                        stage: AudioProcessingStage::FinalProtection,
                    }],
                },
            },
            AudioTrackSelection {
                loudness_analysis: Some(AudioLoudnessAnalysis {
                    input_lra: Some(5.0),
                    input_threshold: Some(-30.0),
                    integrated_lufs: Some(-20.0),
                    true_peak_db: Some(-5.0),
                }),
                stream_index: 4,
                processing: AudioTrackProcessing {
                    gain_db: 0.0,
                    loudness_normalization: Some(LoudnessNormalization::Preset(
                        LoudnessPreset::Streaming,
                    )),
                    effects: vec![AudioTrackSignalEffect::Limiter {
                        ceiling_db: -2.0,
                        stage: AudioProcessingStage::FinalProtection,
                    }],
                },
            },
        ];

        let graph = audio_filter_graph(&tracks, true);

        assert!(graph.contains(
            "[0:2]volume=-3.000000dB,alimiter=limit=0.891251:attack=5:release=50:level=0:latency=1[audio0]"
        ));
        assert!(graph.contains(
            "aresample=48000,alimiter=limit=0.794328:attack=5:release=50:level=0:latency=1[audio1]"
        ));
        assert!(graph.ends_with(
            "[audio0][audio1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]"
        ));
    }

    #[test]
    fn integrated_cleanup_level_policy_and_limiter_order_matches_every_output_route() {
        let cleanup = vec![
            AudioTrackSignalEffect::NoiseReduction {
                preset: NoiseReductionPreset::Medium,
                stage: AudioProcessingStage::Cleanup,
            },
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 100.0,
                stage: AudioProcessingStage::Cleanup,
            },
            AudioTrackSignalEffect::Limiter {
                ceiling_db: -1.0,
                stage: AudioProcessingStage::FinalProtection,
            },
        ];
        let manual = AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 6.0,
                loudness_normalization: None,
                effects: cleanup.clone(),
            },
        };
        let normalized = AudioTrackSelection {
            loudness_analysis: Some(AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            }),
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 6.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Streaming,
                )),
                effects: cleanup,
            },
        };

        let manual_graph = audio_filter_graph(std::slice::from_ref(&manual), false);
        let normalized_graph = audio_filter_graph(std::slice::from_ref(&normalized), false);
        let manual_order = [
            "highpass=f=100.000",
            "afftdn=nr=12:nf=-35",
            "volume=6.000000dB",
            "alimiter=limit=0.891251",
        ];
        let normalized_order = [
            "highpass=f=100.000",
            "afftdn=nr=12:nf=-35",
            "loudnorm=I=-16.000:TP=-1.500:LRA=11",
            "alimiter=limit=0.891251",
        ];
        let assert_order = |graph: &str, stages: &[&str]| {
            let mut last_position = 0;
            for stage in stages {
                let position = graph.find(stage).expect("pipeline stage is present");
                assert!(
                    position >= last_position,
                    "{stage} must follow the prior stage"
                );
                last_position = position;
            }
        };

        assert_order(&manual_graph, &manual_order);
        assert_order(&normalized_graph, &normalized_order);
        assert!(manual_graph.contains("volume=6.000000dB,alimiter"));
        assert!(normalized_graph.contains("measured_I=-20.000000"));
    }

    #[test]
    fn waveform_filter_chain_contains_only_pre_level_shaping_effects() {
        let processing = AudioTrackProcessing {
            gain_db: 6.0,
            loudness_normalization: None,
            effects: vec![
                AudioTrackSignalEffect::HighPass {
                    cutoff_hz: 100.0,
                    stage: AudioProcessingStage::Cleanup,
                },
                AudioTrackSignalEffect::NoiseReduction {
                    preset: NoiseReductionPreset::Medium,
                    stage: AudioProcessingStage::Cleanup,
                },
                AudioTrackSignalEffect::Limiter {
                    ceiling_db: -1.0,
                    stage: AudioProcessingStage::FinalProtection,
                },
            ],
        };

        assert_eq!(
            waveform_signal_filter_chain(&processing),
            "highpass=f=100.000,afftdn=nr=12:nf=-35"
        );
    }

    #[test]
    fn activity_cache_key_changes_with_limiter_ceiling() {
        let selection = |ceiling_db| AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 1,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects: vec![AudioTrackSignalEffect::Limiter {
                    ceiling_db,
                    stage: AudioProcessingStage::FinalProtection,
                }],
            },
        };

        assert_ne!(
            AudioTrackCacheKey::from(&selection(-1.0)),
            AudioTrackCacheKey::from(&selection(-2.0)),
        );
    }

    #[test]
    fn signal_effect_order_is_deterministic_for_filter_graphs_and_cache_keys() {
        let effects = [
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 300.0,
                stage: AudioProcessingStage::Cleanup,
            },
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 100.0,
                stage: AudioProcessingStage::Cleanup,
            },
        ];
        let selection = |effects| AudioTrackSelection {
            loudness_analysis: None,
            stream_index: 1,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: None,
                effects,
            },
        };
        let ascending = selection(effects.to_vec());
        let descending = selection(effects.into_iter().rev().collect());

        assert_eq!(
            pre_level_filter_chain(&ascending.processing),
            "highpass=f=100.000,highpass=f=300.000"
        );
        assert_eq!(
            pre_level_filter_chain(&ascending.processing),
            pre_level_filter_chain(&descending.processing)
        );
        assert_eq!(
            AudioTrackCacheKey::from(&ascending),
            AudioTrackCacheKey::from(&descending)
        );
    }

    #[test]
    fn export_rejects_invalid_limiter_stages_ranges_and_duplicates() {
        for (stage, ceiling_db) in [
            (AudioProcessingStage::Cleanup, -1.0),
            (AudioProcessingStage::FinalProtection, -24.1),
            (AudioProcessingStage::FinalProtection, 0.1),
        ] {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.audio_tracks[0].processing.effects =
                vec![AudioTrackSignalEffect::Limiter { ceiling_db, stage }];
            let error = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect_err("limiter settings must match its final-protection range");
            assert_eq!(error.code, "invalid_request");
        }

        let mut duplicate = optimized_request("-c:v libx264 -crf 20");
        duplicate.audio_tracks[0].processing.effects = vec![
            AudioTrackSignalEffect::Limiter {
                ceiling_db: -1.0,
                stage: AudioProcessingStage::FinalProtection,
            },
            AudioTrackSignalEffect::Limiter {
                ceiling_db: -2.0,
                stage: AudioProcessingStage::FinalProtection,
            },
        ];
        let error = build_optimized_arguments(
            &media(),
            &duplicate,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect_err("limiter is a singleton signal effect");
        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn analysis_and_normalization_share_the_same_pre_level_filter_chain() {
        let track = AudioTrackSelection {
            loudness_analysis: Some(AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            }),
            stream_index: 2,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::Streaming,
                )),
                effects: vec![
                    AudioTrackSignalEffect::NoiseReduction {
                        preset: NoiseReductionPreset::Medium,
                        stage: AudioProcessingStage::Cleanup,
                    },
                    AudioTrackSignalEffect::HighPass {
                        cutoff_hz: 100.0,
                        stage: AudioProcessingStage::Cleanup,
                    },
                    AudioTrackSignalEffect::HighPass {
                        cutoff_hz: 300.0,
                        stage: AudioProcessingStage::FinalProtection,
                    },
                ],
            },
        };

        assert_eq!(
            pre_level_filter_chain(&track.processing),
            "highpass=f=100.000,afftdn=nr=12:nf=-35"
        );
        let graph = audio_filter_graph(&[track], false);
        assert!(graph.starts_with(
            "[0:2]highpass=f=100.000,afftdn=nr=12:nf=-35,loudnorm=I=-16.000:TP=-1.500:LRA=11:measured_I="
        ));
        assert!(graph.ends_with("aresample=48000,highpass=f=300.000[audio0]"));
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
                    loudness_analysis: None,
                    stream_index: 1,
                    processing: AudioTrackProcessing {
                        gain_db: 0.0,
                        loudness_normalization: None,
                        effects: Vec::new(),
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
    fn export_rejects_duplicate_noise_reduction_effects() {
        let mut request = optimized_request("-c:v libx264 -crf 20");
        request.audio_tracks[0].processing.effects = vec![
            AudioTrackSignalEffect::NoiseReduction {
                preset: NoiseReductionPreset::Light,
                stage: AudioProcessingStage::Cleanup,
            },
            AudioTrackSignalEffect::NoiseReduction {
                preset: NoiseReductionPreset::Strong,
                stage: AudioProcessingStage::Cleanup,
            },
        ];

        let error = build_optimized_arguments(
            &media(),
            &request,
            Path::new("source.mkv"),
            Path::new("out.mp4"),
        )
        .expect_err("noise reduction is a singleton signal effect");

        assert_eq!(error.code, "invalid_request");
    }

    #[test]
    fn audio_track_validation_enforces_high_pass_uniqueness_per_stage() {
        let mut track = optimized_request("-c:v libx264 -crf 20").audio_tracks[0].clone();
        track.processing.effects = vec![
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 60.0,
                stage: AudioProcessingStage::Cleanup,
            },
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 80.0,
                stage: AudioProcessingStage::Cleanup,
            },
        ];
        assert!(validate_audio_track_selections(&media(), &[track.clone()]).is_err());

        track.processing.effects = vec![
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 60.0,
                stage: AudioProcessingStage::Cleanup,
            },
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 80.0,
                stage: AudioProcessingStage::Dynamics,
            },
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 100.0,
                stage: AudioProcessingStage::FinalProtection,
            },
        ];
        assert!(validate_audio_track_selections(&media(), &[track]).is_ok());
    }

    #[test]
    fn export_rejects_signal_effects_assigned_to_invalid_processing_stages() {
        for effect in [
            AudioTrackSignalEffect::NoiseReduction {
                preset: NoiseReductionPreset::Medium,
                stage: AudioProcessingStage::Dynamics,
            },
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 120.0,
                stage: AudioProcessingStage::LevelPolicy,
            },
        ] {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.audio_tracks[0].processing.effects = vec![effect];
            let error = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect_err("effects cannot be assigned to an incompatible stage");

            assert_eq!(error.code, "invalid_request");
        }

        assert!(
            serde_json::from_value::<AudioTrackSignalEffect>(serde_json::json!({
                "type": "noiseReduction",
                "preset": "medium",
                "stage": "unknownStage"
            }))
            .is_err()
        );
    }

    #[test]
    fn high_pass_signal_effect_round_trips_frontend_camel_case_fields() {
        let frontend_payload = serde_json::json!({
            "type": "highPass",
            "cutoffHz": 80.0,
            "stage": "cleanup"
        });

        let effect: AudioTrackSignalEffect = serde_json::from_value(frontend_payload.clone())
            .expect("frontend payload deserializes");

        assert_eq!(
            effect,
            AudioTrackSignalEffect::HighPass {
                cutoff_hz: 80.0,
                stage: AudioProcessingStage::Cleanup,
            }
        );
        assert_eq!(
            serde_json::to_value(effect).expect("effect serializes"),
            frontend_payload
        );
    }

    #[test]
    fn export_rejects_out_of_range_high_pass_cutoffs() {
        for cutoff_hz in [9.0, 20_001.0] {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.audio_tracks[0].processing.effects = vec![AudioTrackSignalEffect::HighPass {
                cutoff_hz,
                stage: AudioProcessingStage::Cleanup,
            }];

            let error = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect_err("high-pass cutoff must be within the supported frequency range");

            assert_eq!(error.code, "invalid_request");
        }
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
    fn export_rejects_non_finite_loudness_measurements() {
        for analysis in [
            AudioLoudnessAnalysis {
                input_lra: Some(f64::NAN),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            },
            AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(f64::INFINITY),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            },
        ] {
            let mut request = optimized_request("-c:v libx264 -crf 20");
            request.audio_tracks[0].processing.loudness_normalization =
                Some(LoudnessNormalization::Preset(LoudnessPreset::Streaming));
            request.audio_tracks[0].loudness_analysis = Some(analysis);
            let error = build_optimized_arguments(
                &media(),
                &request,
                Path::new("source.mkv"),
                Path::new("out.mp4"),
            )
            .expect_err("non-finite measurements must not reach FFmpeg filters");
            assert_eq!(error.code, "invalid_request");
        }
    }

    #[test]
    fn fast_export_reencodes_when_only_track_normalization_is_enabled() {
        let track = AudioTrackSelection {
            loudness_analysis: Some(AudioLoudnessAnalysis {
                input_lra: Some(5.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            }),
            stream_index: 1,
            processing: AudioTrackProcessing {
                gain_db: 0.0,
                loudness_normalization: Some(LoudnessNormalization::Preset(
                    LoudnessPreset::WebVideo,
                )),
                effects: Vec::new(),
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
        assert!(values.iter().any(|value| {
            value.contains("[0:1]loudnorm=I=-14.000:TP=-1.000:LRA=11")
                && value.contains("aresample=48000[audio0]")
        }));
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
