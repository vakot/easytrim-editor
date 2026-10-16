//! Ordered per-track audio filter chains: the model, the FFmpeg compiler shared by every
//! consumer, and global loudness analysis.

pub mod analysis;
pub mod compiler;
pub mod model;
#[cfg(test)]
pub(crate) mod test_fixtures;
