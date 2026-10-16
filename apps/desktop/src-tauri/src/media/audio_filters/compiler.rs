use crate::error::AppError;

use super::capabilities::{ExecutionStrategy, SignalMemory, frames_for_seconds};
use super::model::{
    AudioFilter, AudioFilterKind, AudioLoudnessAnalysis, FilterMeasurement, invalid_chain,
    validate_filter_chain, validate_measurements,
};

/// Every processed signal is rendered at this rate so filter coefficients, latency compensation,
/// analysis, and processed sample positions agree across playback, export, and analysis.
pub const CANONICAL_SAMPLE_RATE: u32 = 48_000;

/// Places the first decoded sample on the input timeline (padding a late stream start with
/// silence) and converts to the canonical rate before any filter runs.
const CANONICAL_INPUT_STAGE: &str = "aresample=48000:async=1:first_pts=0";

/// afftdn delays its output by half of its 50 ms analysis window at 48 kHz and drops the same
/// amount of trailing signal. The compiled stage pads the tail and removes the delay.
const NOISE_REDUCTION_LATENCY_FRAMES: u64 = 1_200;

/// The FFmpeg form of one filter instance, kept in chain order, with the signal memory that decides
/// how ranges of it may be rendered.
#[derive(Clone, Debug, PartialEq)]
pub struct CompiledStage {
    pub filter_id: String,
    pub graph: String,
    pub memory: SignalMemory,
}

/// A validated, measurement-resolved chain. It is the single filter implementation shared by
/// export, analysis, activity detection, waveforms, and playback rendering.
#[derive(Clone, Debug, PartialEq)]
pub struct CompiledChain {
    stages: Vec<CompiledStage>,
}

impl CompiledChain {
    #[cfg(test)]
    pub fn stages(&self) -> &[CompiledStage] {
        &self.stages
    }

    pub fn is_empty(&self) -> bool {
        self.stages.is_empty()
    }

    /// The execution strategy required by the complete ordered chain.
    pub fn strategy(&self) -> ExecutionStrategy {
        ExecutionStrategy::for_stages(self.stages.iter().map(|stage| stage.memory))
    }

    /// The stages in execution order, expecting canonical-rate input.
    pub fn stage_graph(&self) -> Option<String> {
        (!self.stages.is_empty()).then(|| {
            self.stages
                .iter()
                .map(|stage| stage.graph.as_str())
                .collect::<Vec<_>>()
                .join(",")
        })
    }

    /// The canonical input alignment followed by every stage. Consumers that address processed
    /// samples (analysis, activity, rendering) always use it, even for an empty chain.
    pub fn canonical_graph(&self) -> String {
        match self.stage_graph() {
            Some(stages) => format!("{CANONICAL_INPUT_STAGE},{stages}"),
            None => CANONICAL_INPUT_STAGE.to_owned(),
        }
    }

    /// The canonical graph, or `None` for an empty chain whose source signal can pass through an
    /// export unchanged at its original rate.
    pub fn processing_graph(&self) -> Option<String> {
        (!self.is_empty()).then(|| self.canonical_graph())
    }
}

/// Compiles filters strictly in array order. Every loudness normalization instance must have a
/// measurement of the signal that reaches it; a missing measurement is an error rather than an
/// implicit reorder or skip.
pub fn compile_chain(
    filters: &[AudioFilter],
    measurements: &[FilterMeasurement],
) -> Result<CompiledChain, AppError> {
    validate_filter_chain(filters)?;
    validate_measurements(filters, measurements)?;
    let stages = filters
        .iter()
        .map(|filter| {
            let measurement = measurements
                .iter()
                .find(|measurement| measurement.filter_id == filter.id)
                .map(|measurement| measurement.analysis);
            let (graph, memory) = compile_filter(&filter.kind, measurement)?;
            Ok(CompiledStage {
                filter_id: filter.id.clone(),
                graph,
                memory,
            })
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    Ok(CompiledChain { stages })
}

fn compile_filter(
    kind: &AudioFilterKind,
    measurement: Option<AudioLoudnessAnalysis>,
) -> Result<(String, SignalMemory), AppError> {
    Ok(match *kind {
        // A two-pole IIR filter: its impulse response decays below float precision after roughly
        // four cycles of the cutoff frequency.
        AudioFilterKind::HighPass { cutoff_hz } => (
            format!("highpass=f={cutoff_hz}"),
            SignalMemory::Decaying {
                settle_frames: frames_for_seconds((4.0 / cutoff_hz).max(0.01)),
            },
        ),
        // Overlapping FFT windows plus per-bin gain smoothing (adaptivity) carry state forward.
        AudioFilterKind::NoiseReduction {
            reduction_db,
            noise_floor_db,
        } => (
            format!(
                "apad=pad_len={NOISE_REDUCTION_LATENCY_FRAMES},afftdn=nr={reduction_db}:nf={noise_floor_db},atrim=start_sample={NOISE_REDUCTION_LATENCY_FRAMES},asetpts=PTS-STARTPTS"
            ),
            SignalMemory::Decaying {
                settle_frames: frames_for_seconds(1.0),
            },
        ),
        AudioFilterKind::Limiter {
            ceiling_db,
            attack_ms,
            release_ms,
        } => {
            // A true limiter with look-ahead, compensated so its output stays sample-aligned. Its
            // gain envelope recovers over the release time, which is not a hard clip.
            let limit = 10.0_f64.powf(ceiling_db / 20.0);
            (
                format!(
                    "alimiter=limit={limit:.6}:attack={attack_ms}:release={release_ms}:level=0:latency=1"
                ),
                SignalMemory::Decaying {
                    settle_frames: frames_for_seconds(
                        ((attack_ms + 10.0 * release_ms) / 1_000.0).max(0.1),
                    ),
                },
            )
        }
        AudioFilterKind::Gain { gain_db } => (
            format!("volume={gain_db}dB:precision=double"),
            SignalMemory::Stateless,
        ),
        AudioFilterKind::LoudnessNormalization {
            target_lufs,
            max_true_peak_db,
            loudness_range_lu,
        } => normalization_graph(
            target_lufs,
            max_true_peak_db,
            loudness_range_lu,
            measurement.ok_or_else(|| invalid_chain("a loudness normalization is not measured"))?,
        ),
    })
}

/// Second pass of FFmpeg's two-pass loudness normalization.
///
/// When loudnorm would select linear mode it applies one constant gain, which `volume` reproduces
/// bit-exactly while keeping the stage stateless. Otherwise loudnorm runs in dynamic mode, which
/// upsamples internally, so its output returns to the canonical rate.
fn normalization_graph(
    target_lufs: f64,
    max_true_peak_db: f64,
    loudness_range_lu: f64,
    analysis: AudioLoudnessAnalysis,
) -> (String, SignalMemory) {
    let Some(measured_i) = analysis.integrated_lufs else {
        // Silence has no measurable loudness; normalizing it would only amplify noise.
        return ("anull".to_owned(), SignalMemory::Stateless);
    };
    if let Some(gain_db) = linear_normalization_gain_db(
        target_lufs,
        max_true_peak_db,
        loudness_range_lu,
        measured_i,
        analysis,
    ) {
        return (
            format!("volume={gain_db}dB:precision=double"),
            SignalMemory::Stateless,
        );
    }

    let mut graph = format!(
        "loudnorm=I={target_lufs}:TP={max_true_peak_db}:LRA={loudness_range_lu}:measured_I={measured_i}"
    );
    if let Some(true_peak_db) = analysis.true_peak_db {
        graph.push_str(&format!(":measured_TP={true_peak_db}"));
    }
    if let Some(input_lra) = analysis.input_lra {
        graph.push_str(&format!(":measured_LRA={input_lra}"));
    }
    if let Some(input_threshold) = analysis.input_threshold {
        graph.push_str(&format!(":measured_thresh={input_threshold}"));
    }
    graph.push_str(&format!(":linear=false,aresample={CANONICAL_SAMPLE_RATE}"));
    // Dynamic loudnorm's gain at any point depends on the whole history since its first sample.
    (graph, SignalMemory::Unbounded)
}

/// Mirrors loudnorm's linear-mode eligibility so the compiled stage matches FFmpeg's choice.
fn linear_normalization_gain_db(
    target_lufs: f64,
    max_true_peak_db: f64,
    loudness_range_lu: f64,
    measured_i: f64,
    analysis: AudioLoudnessAnalysis,
) -> Option<f64> {
    let (Some(measured_tp), Some(measured_lra), Some(measured_thresh)) = (
        analysis.true_peak_db,
        analysis.input_lra,
        analysis.input_threshold,
    ) else {
        return None;
    };
    // loudnorm treats these values as "not measured" and falls back to dynamic mode.
    if measured_i == 0.0 || measured_lra == 0.0 || measured_thresh == -70.0 || measured_tp == 99.0 {
        return None;
    }
    let gain_db = target_lufs - measured_i;
    (measured_tp + gain_db <= max_true_peak_db && measured_lra <= loudness_range_lu)
        .then_some(gain_db)
}

#[cfg(test)]
mod tests {
    use std::ffi::OsString;

    use crate::media::audio_filters::{
        capabilities::ExecutionStrategy,
        model::{AudioFilterKind, AudioLoudnessAnalysis, FilterMeasurement, fixtures::*},
        test_fixtures::{decode_f32_stereo, generate_fixture},
    };

    use super::{CANONICAL_INPUT_STAGE, compile_chain};

    fn measured(
        filter_id: &str,
        integrated_lufs: f64,
        true_peak_db: f64,
        lra: f64,
    ) -> FilterMeasurement {
        FilterMeasurement {
            filter_id: filter_id.to_owned(),
            analysis: AudioLoudnessAnalysis {
                input_lra: Some(lra),
                input_threshold: Some(integrated_lufs - 10.0),
                integrated_lufs: Some(integrated_lufs),
                true_peak_db: Some(true_peak_db),
            },
        }
    }

    fn graphs(
        filters: &[crate::media::audio_filters::model::AudioFilter],
        measurements: &[FilterMeasurement],
    ) -> Vec<String> {
        compile_chain(filters, measurements)
            .unwrap()
            .stages()
            .iter()
            .map(|stage| stage.graph.clone())
            .collect()
    }

    #[test]
    fn compiles_filters_in_exact_array_order() {
        let forward = [high_pass("hp", 80.0), gain("g", 6.0), limiter("lim", -1.0)];
        let reversed = [limiter("lim", -1.0), gain("g", 6.0), high_pass("hp", 80.0)];
        assert_eq!(
            graphs(&forward, &[]),
            [
                "highpass=f=80",
                "volume=6dB:precision=double",
                "alimiter=limit=0.891251:attack=5:release=50:level=0:latency=1",
            ]
        );
        let mut reversed_graphs = graphs(&reversed, &[]);
        reversed_graphs.reverse();
        assert_eq!(reversed_graphs, graphs(&forward, &[]));
    }

    #[test]
    fn repeated_instances_compile_independently_with_their_own_identity() {
        let chain = compile_chain(
            &[gain("a", 3.0), high_pass("hp", 100.0), gain("b", -9.5)],
            &[],
        )
        .unwrap();
        assert_eq!(
            chain
                .stages()
                .iter()
                .map(|stage| (stage.filter_id.as_str(), stage.graph.as_str()))
                .collect::<Vec<_>>(),
            [
                ("a", "volume=3dB:precision=double"),
                ("hp", "highpass=f=100"),
                ("b", "volume=-9.5dB:precision=double"),
            ]
        );
    }

    #[test]
    fn processing_graph_aligns_and_resamples_before_the_first_filter() {
        let chain = compile_chain(&[high_pass("hp", 80.0)], &[]).unwrap();
        assert_eq!(
            chain.processing_graph().unwrap(),
            format!("{CANONICAL_INPUT_STAGE},highpass=f=80")
        );
        assert_eq!(compile_chain(&[], &[]).unwrap().processing_graph(), None);
    }

    #[test]
    fn noise_reduction_compensates_its_analysis_window_latency() {
        assert_eq!(
            graphs(&[noise_reduction("nr")], &[]),
            ["apad=pad_len=1200,afftdn=nr=12:nf=-35,atrim=start_sample=1200,asetpts=PTS-STARTPTS"]
        );
    }

    #[test]
    fn gain_and_normalization_coexist_and_interact_only_through_order() {
        let measurement = measured("norm", -20.0, -9.0, 6.0);
        assert_eq!(
            graphs(
                &[
                    gain("pre", 6.0),
                    normalization("norm", -16.0),
                    gain("post", -3.0)
                ],
                &[measurement]
            ),
            [
                "volume=6dB:precision=double",
                "volume=4dB:precision=double",
                "volume=-3dB:precision=double",
            ]
        );
    }

    #[test]
    fn normalization_uses_dynamic_loudnorm_when_linear_gain_would_exceed_the_true_peak() {
        let measurement = measured("norm", -30.0, -2.0, 6.0);
        assert_eq!(
            graphs(&[normalization("norm", -16.0)], &[measurement]),
            [
                "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-30:measured_TP=-2:measured_LRA=6:measured_thresh=-40:linear=false,aresample=48000"
            ]
        );
    }

    #[test]
    fn normalization_follows_loudnorm_linear_eligibility_for_wide_loudness_range() {
        let measurement = measured("norm", -20.0, -9.0, 15.0);
        assert!(
            graphs(&[normalization("norm", -16.0)], &[measurement])[0].starts_with("loudnorm=")
        );
    }

    #[test]
    fn silent_normalization_input_passes_through() {
        let measurement = FilterMeasurement {
            filter_id: "norm".to_owned(),
            analysis: AudioLoudnessAnalysis {
                input_lra: None,
                input_threshold: None,
                integrated_lufs: None,
                true_peak_db: None,
            },
        };
        assert_eq!(
            graphs(&[normalization("norm", -16.0)], &[measurement]),
            ["anull"]
        );
    }

    #[test]
    fn unmeasured_normalization_is_rejected_instead_of_skipped() {
        let error =
            compile_chain(&[gain("g", 1.0), normalization("norm", -16.0)], &[]).unwrap_err();
        assert_eq!(
            error.diagnostics.as_deref(),
            Some("a loudness normalization is not measured")
        );
    }

    #[test]
    fn compiled_stateful_stages_keep_output_sample_aligned_and_complete() {
        // A click at exactly one second over a quiet tone.
        let fixture = generate_fixture(
            "latency",
            "aevalsrc=exprs='if(between(t,1,1.0001),0.9,0)+0.001*sin(2*PI*1000*t)':s=48000:d=3:c=stereo",
            "wav",
            "pcm_f32le",
        );
        let transparent_noise_reduction = filter(
            "nr",
            AudioFilterKind::NoiseReduction {
                reduction_db: 0.01,
                noise_floor_db: -80.0,
            },
        );
        for filters in [
            vec![transparent_noise_reduction],
            vec![limiter("lim", -1.0)],
            vec![high_pass("hp", 20.0)],
        ] {
            let chain = compile_chain(&filters, &[]).unwrap();
            let output = decode_f32_stereo(&[
                OsString::from("-i"),
                fixture.path().as_os_str().to_owned(),
                OsString::from("-filter_complex"),
                OsString::from(format!("[0:0]{}[out]", chain.canonical_graph())),
                OsString::from("-map"),
                OsString::from("[out]"),
            ]);
            assert_eq!(
                output.len(),
                3 * 48_000 * 2,
                "{filters:?} changed the length"
            );
            let peak_frame = output
                .chunks_exact(2)
                .enumerate()
                .max_by(|(_, left), (_, right)| left[0].abs().total_cmp(&right[0].abs()))
                .map(|(frame, _)| frame)
                .unwrap();
            assert!(
                (48_000..48_006).contains(&peak_frame),
                "{filters:?} moved the click to frame {peak_frame}"
            );
        }
    }

    #[test]
    fn classifies_the_execution_strategy_of_the_complete_chain() {
        let linear = measured("norm", -20.0, -9.0, 6.0);
        let dynamic = measured("norm", -30.0, -2.0, 6.0);
        assert_eq!(
            compile_chain(&[gain("g", 3.0), normalization("norm", -16.0)], &[linear])
                .unwrap()
                .strategy(),
            ExecutionStrategy::RandomAccess
        );
        assert!(matches!(
            compile_chain(&[normalization("norm", -16.0)], &[dynamic])
                .unwrap()
                .strategy(),
            ExecutionStrategy::Sequential { .. }
        ));
        let limited = compile_chain(&[gain("g", 3.0), limiter("lim", -1.0)], &[]).unwrap();
        assert_eq!(
            limited.strategy(),
            ExecutionStrategy::Sequential {
                warmup_frames: 24_240
            }
        );
        assert!(matches!(
            compile_chain(&[high_pass("hp", 80.0), noise_reduction("nr")], &[])
                .unwrap()
                .strategy(),
            ExecutionStrategy::Sequential { warmup_frames } if warmup_frames == 2_400 + 48_000
        ));
    }

    #[test]
    fn multiple_normalization_instances_each_use_their_own_measurement() {
        let chain = graphs(
            &[
                normalization("first", -20.0),
                limiter("lim", -1.0),
                normalization("second", -14.0),
            ],
            &[
                measured("first", -24.0, -12.0, 5.0),
                measured("second", -19.5, -1.0, 5.0),
            ],
        );
        assert_eq!(chain[0], "volume=4dB:precision=double");
        assert!(chain[2].starts_with("loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-19.5"));
    }
}
