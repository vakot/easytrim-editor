use super::compiler::CANONICAL_SAMPLE_RATE;

/// Frames decoded before a provisional render start so the decoder and resampler settle. Decoder
/// state is not proven equivalent to a continuous decode, which keeps such renders provisional.
pub const DECODER_PREROLL_FRAMES: u64 = CANONICAL_SAMPLE_RATE as u64 / 2;

/// Warm-up for stages whose state depends on the whole signal history. It cannot converge; it only
/// keeps provisional previews close to the continuous result.
const UNBOUNDED_MEMORY_WARMUP_FRAMES: u64 = 10 * CANONICAL_SAMPLE_RATE as u64;

/// How a compiled stage carries signal context from earlier samples to later output.
///
/// This is one of the three capability categories. The other, global analysis, belongs to the
/// filter type (`AudioFilterKind::requires_global_analysis`) because it must be known before the
/// measurement that decides a normalization stage's memory exists. Categories overlap: dynamic
/// loudness normalization needs global analysis and has unbounded memory.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SignalMemory {
    /// Each output sample depends only on the input sample at the same position.
    Stateless,
    /// The stage keeps state that decays; its output converges after roughly `settle_frames`.
    Decaying { settle_frames: u64 },
    /// The stage's output depends on the complete history since its first sample.
    Unbounded,
}

/// How a renderer may produce ranges of a complete ordered chain.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExecutionStrategy {
    /// Every stage is stateless, so a range needs only decoder preroll.
    RandomAccess,
    /// At least one stage keeps state. Canonical output requires one continuous render from the
    /// range origin; provisional renders warm the chain up for `warmup_frames` first.
    Sequential { warmup_frames: u64 },
}

impl ExecutionStrategy {
    /// Chooses the strategy for stages that run one after another. Warm-up adds up because each
    /// stage only settles once its own input has settled.
    pub(crate) fn for_stages(memories: impl IntoIterator<Item = SignalMemory>) -> Self {
        let mut warmup_frames = 0_u64;
        let mut stateful = false;
        for memory in memories {
            let settle_frames = match memory {
                SignalMemory::Stateless => continue,
                SignalMemory::Decaying { settle_frames } => settle_frames,
                SignalMemory::Unbounded => UNBOUNDED_MEMORY_WARMUP_FRAMES,
            };
            stateful = true;
            warmup_frames = warmup_frames.saturating_add(settle_frames);
        }
        if stateful {
            Self::Sequential { warmup_frames }
        } else {
            Self::RandomAccess
        }
    }

    /// Frames rendered and discarded before a provisional range start.
    pub(crate) fn provisional_preroll_frames(self) -> u64 {
        match self {
            Self::RandomAccess => DECODER_PREROLL_FRAMES,
            Self::Sequential { warmup_frames } => {
                DECODER_PREROLL_FRAMES.saturating_add(warmup_frames)
            }
        }
    }
}

pub(crate) fn frames_for_seconds(seconds: f64) -> u64 {
    (seconds * f64::from(CANONICAL_SAMPLE_RATE)).ceil().max(0.0) as u64
}

#[cfg(test)]
mod tests {
    use super::{
        DECODER_PREROLL_FRAMES, ExecutionStrategy, SignalMemory, UNBOUNDED_MEMORY_WARMUP_FRAMES,
    };

    #[test]
    fn stateless_chains_allow_random_access() {
        let strategy =
            ExecutionStrategy::for_stages([SignalMemory::Stateless, SignalMemory::Stateless]);
        assert_eq!(strategy, ExecutionStrategy::RandomAccess);
        assert_eq!(
            strategy.provisional_preroll_frames(),
            DECODER_PREROLL_FRAMES
        );
    }

    #[test]
    fn any_stateful_stage_makes_the_complete_chain_sequential() {
        let strategy = ExecutionStrategy::for_stages([
            SignalMemory::Stateless,
            SignalMemory::Decaying { settle_frames: 100 },
            SignalMemory::Decaying { settle_frames: 50 },
        ]);
        assert_eq!(
            strategy,
            ExecutionStrategy::Sequential { warmup_frames: 150 }
        );
        assert_eq!(
            strategy.provisional_preroll_frames(),
            DECODER_PREROLL_FRAMES + 150
        );
    }

    #[test]
    fn unbounded_memory_uses_the_maximum_warmup() {
        assert_eq!(
            ExecutionStrategy::for_stages([SignalMemory::Unbounded]),
            ExecutionStrategy::Sequential {
                warmup_frames: UNBOUNDED_MEMORY_WARMUP_FRAMES
            }
        );
    }
}
