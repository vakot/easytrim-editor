use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppErrorMessageId};

pub const MAX_AUDIO_FILTERS: usize = 32;
pub const MAX_TRACK_VOLUME: f64 = 5.0;
const MAX_FILTER_ID_LENGTH: usize = 64;

/// One instance in a track's ordered filter chain. The chain array order is the execution order;
/// there is no implicit stage sorting.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFilter {
    pub id: String,
    /// A disabled instance keeps its position and parameters but is never compiled, measured, or
    /// rendered. Chains saved before the toggle existed have every instance enabled.
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
    #[serde(flatten)]
    pub kind: AudioFilterKind,
}

impl AudioFilter {
    /// Whether this instance takes part in processing and needs a global-analysis measurement.
    pub(crate) fn requires_global_analysis(&self) -> bool {
        self.enabled && self.kind.requires_global_analysis()
    }
}

fn enabled_by_default() -> bool {
    true
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AudioFilterKind {
    HighPass {
        cutoff_hz: f64,
    },
    NoiseReduction {
        reduction_db: f64,
        noise_floor_db: f64,
    },
    Limiter {
        ceiling_db: f64,
        attack_ms: f64,
        release_ms: f64,
    },
    LoudnessNormalization {
        target_lufs: f64,
        max_true_peak_db: f64,
        loudness_range_lu: f64,
    },
    Gain {
        gain_db: f64,
    },
}

impl AudioFilterKind {
    /// Global analysis needs the complete relevant range before rendering. This is a property of
    /// the filter type, known before any measurement exists.
    pub(crate) fn requires_global_analysis(&self) -> bool {
        matches!(self, Self::LoudnessNormalization { .. })
    }

    fn validate(&self) -> Result<(), &'static str> {
        let in_range =
            |value: f64, min: f64, max: f64| value.is_finite() && (min..=max).contains(&value);
        let valid = match *self {
            Self::HighPass { cutoff_hz } => in_range(cutoff_hz, 10.0, 20_000.0),
            // afftdn accepts 0.01..97 dB of reduction and a -80..-20 dB noise floor.
            Self::NoiseReduction {
                reduction_db,
                noise_floor_db,
            } => in_range(reduction_db, 0.01, 97.0) && in_range(noise_floor_db, -80.0, -20.0),
            // The ceiling stays above alimiter's 0.0625 linear minimum (-24.08 dB).
            Self::Limiter {
                ceiling_db,
                attack_ms,
                release_ms,
            } => {
                in_range(ceiling_db, -24.0, 0.0)
                    && in_range(attack_ms, 0.1, 80.0)
                    && in_range(release_ms, 1.0, 8_000.0)
            }
            Self::LoudnessNormalization {
                target_lufs,
                max_true_peak_db,
                loudness_range_lu,
            } => {
                in_range(target_lufs, -36.0, -5.0)
                    && in_range(max_true_peak_db, -9.0, 0.0)
                    && in_range(loudness_range_lu, 1.0, 50.0)
            }
            Self::Gain { gain_db } => in_range(gain_db, -60.0, 24.0),
        };
        if valid {
            Ok(())
        } else {
            Err("a filter parameter is outside its supported range")
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioLoudnessAnalysis {
    pub input_lra: Option<f64>,
    pub input_threshold: Option<f64>,
    pub integrated_lufs: Option<f64>,
    pub true_peak_db: Option<f64>,
}

impl AudioLoudnessAnalysis {
    fn is_finite(&self) -> bool {
        [
            self.input_lra,
            self.input_threshold,
            self.integrated_lufs,
            self.true_peak_db,
        ]
        .into_iter()
        .flatten()
        .all(f64::is_finite)
    }
}

/// A global-analysis result for one loudness normalization instance: the loudness of the exact
/// signal that reaches that instance.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterMeasurement {
    pub filter_id: String,
    #[serde(flatten)]
    pub analysis: AudioLoudnessAnalysis,
}

/// A track's ordered filters without its post-filter volume. Analysis, activity detection, and
/// processed PCM rendering depend only on this selection.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioChainSelection {
    pub stream_index: u32,
    pub filters: Vec<AudioFilter>,
    #[serde(default)]
    pub loudness_measurements: Vec<FilterMeasurement>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioSyncOffset {
    pub enabled: bool,
    pub offset_micros: i64,
}

impl AudioSyncOffset {
    pub fn effective_micros(&self) -> i64 {
        if self.enabled { self.offset_micros } else { 0 }
    }
}

/// An exported track: its filter chain followed by its Track Volume multiplier.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrackSelection {
    #[serde(default)]
    pub sync_offset: Option<AudioSyncOffset>,
    #[serde(flatten)]
    pub chain: AudioChainSelection,
    pub volume: f64,
}

impl AudioTrackSelection {
    pub fn stream_index(&self) -> u32 {
        self.chain.stream_index
    }

    pub(crate) fn needs_processing(&self) -> bool {
        self.chain.filters.iter().any(|filter| filter.enabled)
            || self.volume != 1.0
            || self
                .sync_offset
                .as_ref()
                .is_some_and(|offset| offset.effective_micros() != 0)
    }
}

/// Validates the chain structure and parameters. Measurements are checked separately because
/// analysis requests intentionally omit them.
pub(crate) fn validate_filter_chain(filters: &[AudioFilter]) -> Result<(), AppError> {
    if filters.len() > MAX_AUDIO_FILTERS {
        return Err(invalid_chain("the filter chain has too many filters"));
    }
    let mut ids = HashSet::with_capacity(filters.len());
    for filter in filters {
        if !is_valid_filter_id(&filter.id) {
            return Err(invalid_chain("a filter identifier is invalid"));
        }
        if !ids.insert(filter.id.as_str()) {
            return Err(invalid_chain("a filter identifier is duplicated"));
        }
        filter.kind.validate().map_err(invalid_chain)?;
    }
    Ok(())
}

/// Validates that measurements belong to enabled normalization instances in the chain. Missing
/// measurements are reported by the compiler, which knows whether the consumer requires them.
pub(crate) fn validate_measurements(
    filters: &[AudioFilter],
    measurements: &[FilterMeasurement],
) -> Result<(), AppError> {
    let mut measured = HashSet::with_capacity(measurements.len());
    for measurement in measurements {
        let belongs_to_normalization = filters
            .iter()
            .any(|filter| filter.id == measurement.filter_id && filter.requires_global_analysis());
        if !belongs_to_normalization
            || !measured.insert(measurement.filter_id.as_str())
            || !measurement.analysis.is_finite()
        {
            return Err(invalid_chain(
                "a loudness measurement does not match the chain",
            ));
        }
    }
    Ok(())
}

pub(crate) fn validate_track_volume(volume: f64) -> Result<(), AppError> {
    if volume.is_finite() && (0.0..=MAX_TRACK_VOLUME).contains(&volume) {
        Ok(())
    } else {
        Err(invalid_chain("the track volume is outside 0-500%"))
    }
}

fn is_valid_filter_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_FILTER_ID_LENGTH
        && id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

pub(crate) fn invalid_chain(reason: &'static str) -> AppError {
    AppError::invalid_request(
        AppErrorMessageId::ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
    )
    .with_diagnostics(reason)
}

#[cfg(test)]
pub(crate) mod fixtures {
    use super::{AudioFilter, AudioFilterKind};

    pub fn filter(id: &str, kind: AudioFilterKind) -> AudioFilter {
        AudioFilter {
            id: id.to_owned(),
            enabled: true,
            kind,
        }
    }

    pub fn disabled(filter: AudioFilter) -> AudioFilter {
        AudioFilter {
            enabled: false,
            ..filter
        }
    }

    pub fn high_pass(id: &str, cutoff_hz: f64) -> AudioFilter {
        filter(id, AudioFilterKind::HighPass { cutoff_hz })
    }

    pub fn noise_reduction(id: &str) -> AudioFilter {
        filter(
            id,
            AudioFilterKind::NoiseReduction {
                reduction_db: 12.0,
                noise_floor_db: -35.0,
            },
        )
    }

    pub fn limiter(id: &str, ceiling_db: f64) -> AudioFilter {
        filter(
            id,
            AudioFilterKind::Limiter {
                ceiling_db,
                attack_ms: 5.0,
                release_ms: 50.0,
            },
        )
    }

    pub fn normalization(id: &str, target_lufs: f64) -> AudioFilter {
        filter(
            id,
            AudioFilterKind::LoudnessNormalization {
                target_lufs,
                max_true_peak_db: -1.5,
                loudness_range_lu: 11.0,
            },
        )
    }

    pub fn gain(id: &str, gain_db: f64) -> AudioFilter {
        filter(id, AudioFilterKind::Gain { gain_db })
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        AudioChainSelection, AudioFilterKind, AudioLoudnessAnalysis, AudioTrackSelection,
        FilterMeasurement, fixtures::*, validate_filter_chain, validate_measurements,
        validate_track_volume,
    };

    #[test]
    fn deserializes_an_ordered_chain_with_repeated_filter_types() {
        let selection: AudioTrackSelection = serde_json::from_value(json!({
            "streamIndex": 2,
            "volume": 1.5,
            "filters": [
                { "id": "gain-a", "type": "gain", "gainDb": 6 },
                { "id": "norm", "type": "loudnessNormalization", "targetLufs": -16,
                  "maxTruePeakDb": -1.5, "loudnessRangeLu": 11 },
                { "id": "gain-b", "type": "gain", "gainDb": -3 }
            ],
            "loudnessMeasurements": [
                { "filterId": "norm", "integratedLufs": -20, "truePeakDb": -6,
                  "inputLra": 5, "inputThreshold": -30 }
            ]
        }))
        .unwrap();

        assert_eq!(selection.stream_index(), 2);
        assert_eq!(selection.volume, 1.5);
        assert_eq!(
            selection
                .chain
                .filters
                .iter()
                .map(|filter| filter.id.as_str())
                .collect::<Vec<_>>(),
            ["gain-a", "norm", "gain-b"]
        );
        assert_eq!(
            selection.chain.filters[2].kind,
            AudioFilterKind::Gain { gain_db: -3.0 }
        );
        assert_eq!(selection.chain.loudness_measurements[0].filter_id, "norm");
    }

    #[test]
    fn filters_are_enabled_unless_explicitly_disabled() {
        let selection: AudioTrackSelection = serde_json::from_value(json!({
            "streamIndex": 0,
            "volume": 1,
            "filters": [
                { "id": "saved", "type": "gain", "gainDb": 6 },
                { "id": "off", "type": "gain", "gainDb": 6, "enabled": false }
            ]
        }))
        .unwrap();

        assert!(selection.chain.filters[0].enabled);
        assert!(!selection.chain.filters[1].enabled);
        assert!(selection.needs_processing());

        let bypassed = AudioTrackSelection {
            sync_offset: None,
            chain: AudioChainSelection {
                stream_index: 0,
                filters: vec![disabled(gain("g", 6.0)), disabled(limiter("lim", -3.0))],
                loudness_measurements: vec![],
            },
            volume: 1.0,
        };
        assert!(
            !bypassed.needs_processing(),
            "a fully disabled chain keeps the stream eligible for copying"
        );
    }

    #[test]
    fn rejects_unknown_filter_types() {
        let result = serde_json::from_value::<AudioChainSelection>(json!({
            "streamIndex": 0,
            "filters": [{ "id": "a", "type": "reverb" }]
        }));
        assert!(result.is_err());
    }

    #[test]
    fn validates_identifiers_parameters_and_chain_length() {
        assert!(validate_filter_chain(&[gain("a", 0.0), gain("b", 3.0)]).is_ok());
        assert!(validate_filter_chain(&[gain("a", 0.0), gain("a", 3.0)]).is_err());
        assert!(validate_filter_chain(&[gain("bad id", 0.0)]).is_err());
        assert!(validate_filter_chain(&[gain("", 0.0)]).is_err());
        assert!(validate_filter_chain(&[gain("a", 30.0)]).is_err());
        assert!(validate_filter_chain(&[gain("a", f64::NAN)]).is_err());
        assert!(validate_filter_chain(&[high_pass("a", 5.0)]).is_err());
        assert!(validate_filter_chain(&[limiter("a", -30.0)]).is_err());
        assert!(validate_filter_chain(&[normalization("a", -40.0)]).is_err());
        let too_many = (0..33)
            .map(|index| gain(&format!("g{index}"), 0.0))
            .collect::<Vec<_>>();
        assert!(validate_filter_chain(&too_many).is_err());
    }

    #[test]
    fn measurements_must_target_unique_normalization_instances() {
        let chain = [gain("g", 0.0), normalization("n", -16.0)];
        let measurement = |filter_id: &str| FilterMeasurement {
            filter_id: filter_id.to_owned(),
            analysis: AudioLoudnessAnalysis {
                input_lra: Some(4.0),
                input_threshold: Some(-30.0),
                integrated_lufs: Some(-20.0),
                true_peak_db: Some(-5.0),
            },
        };
        assert!(validate_measurements(&chain, &[measurement("n")]).is_ok());
        assert!(validate_measurements(&chain, &[measurement("g")]).is_err());
        assert!(validate_measurements(&chain, &[measurement("n"), measurement("n")]).is_err());
        assert!(validate_measurements(&chain, &[measurement("missing")]).is_err());

        let bypassed = [gain("g", 0.0), disabled(normalization("n", -16.0))];
        assert!(validate_measurements(&bypassed, &[]).is_ok());
        assert!(validate_measurements(&bypassed, &[measurement("n")]).is_err());
    }

    #[test]
    fn track_volume_accepts_zero_to_five_times_amplitude() {
        assert!(validate_track_volume(0.0).is_ok());
        assert!(validate_track_volume(5.0).is_ok());
        assert!(validate_track_volume(5.01).is_err());
        assert!(validate_track_volume(-0.1).is_err());
        assert!(validate_track_volume(f64::INFINITY).is_err());
    }
}
