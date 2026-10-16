use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    time::Duration,
};

use crate::process::{ChildTerminator, StreamingChild};

use super::{
    compiler::CANONICAL_SAMPLE_RATE,
    pcm_cache::{PcmQuality, RenderKey},
};

/// Seek positions are kept on a 125 microsecond grid, which is exactly six frames at 48 kHz, so
/// the requested seek time and its first output frame agree without rounding.
pub const SEEK_GRID_FRAMES: u64 = 6;
const OUTPUT_IDLE_TIMEOUT: Duration = Duration::from_secs(30);
const READ_BLOCK_FRAMES: u64 = 4_096;

/// One persistent FFmpeg process rendering a key continuously from `seek_frame` to the end of the
/// key's range. Consecutive requests continue reading it instead of restarting the process, so
/// stateful filters never see a boundary between them.
pub struct RenderSession {
    pub key: RenderKey,
    pub quality: PcmQuality,
    /// Frames before this position only warm up the chain; they are never cached or returned.
    pub committed_from: u64,
    /// The next frame the process will output.
    pub cursor: u64,
    child: StreamingChild,
}

impl RenderSession {
    pub fn start(
        source_path: &Path,
        key: &RenderKey,
        seek_frame: u64,
        committed_from: u64,
        quality: PcmQuality,
    ) -> io::Result<Self> {
        debug_assert!(seek_frame.is_multiple_of(SEEK_GRID_FRAMES));
        let child = StreamingChild::spawn(
            OsStr::new("ffmpeg"),
            &session_arguments(source_path, key, seek_frame),
        )?;
        Ok(Self {
            key: key.clone(),
            quality,
            committed_from,
            cursor: seek_frame,
            child,
        })
    }

    pub fn terminator(&self) -> ChildTerminator {
        self.child.terminator()
    }

    /// Reads exactly `frames` frames from the cursor, failing if the render ends early.
    pub fn read_frames(
        &mut self,
        frames: u64,
        mut is_cancelled: impl FnMut() -> bool,
    ) -> io::Result<Vec<f32>> {
        let channels = u64::from(self.key.channels);
        let mut samples = Vec::with_capacity((frames * channels) as usize);
        let mut remaining = frames;
        while remaining > 0 {
            let block = remaining.min(READ_BLOCK_FRAMES);
            let bytes = self.child.read_exact_cancellable(
                (block * channels * 4) as usize,
                OUTPUT_IDLE_TIMEOUT,
                &mut is_cancelled,
            )?;
            if bytes.len() as u64 != block * channels * 4 {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "the processed audio render ended before its range end",
                ));
            }
            samples.extend(
                bytes
                    .chunks_exact(4)
                    .map(|sample| f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]])),
            );
            self.cursor += block;
            remaining -= block;
        }
        Ok(samples)
    }
}

/// Renders `[seek_frame, range.end)` of the key continuously. Input stops exactly at the range end,
/// as an export of the range would, and a stream shorter than the range is padded with silence.
fn session_arguments(source_path: &Path, key: &RenderKey, seek_frame: u64) -> Vec<OsString> {
    let length = key.range.end - seek_frame;
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-v"),
        OsString::from("error"),
        OsString::from("-ss"),
        OsString::from(frames_to_seconds(seek_frame)),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-t"),
        OsString::from(frames_to_seconds(length)),
        OsString::from("-filter_complex"),
        OsString::from(format!(
            "[0:{}]{},apad=whole_len={length},atrim=end_sample={length}[processed]",
            key.stream_index, key.graph
        )),
        OsString::from("-map"),
        OsString::from("[processed]"),
        OsString::from("-vn"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-f"),
        OsString::from("f32le"),
        OsString::from("-acodec"),
        OsString::from("pcm_f32le"),
        OsString::from("-ar"),
        OsString::from(CANONICAL_SAMPLE_RATE.to_string()),
        OsString::from("-ac"),
        OsString::from(key.channels.to_string()),
        OsString::from("pipe:1"),
    ]
}

/// Formats a frame position in seconds; on the seek grid it is exact to the microsecond.
fn frames_to_seconds(frames: u64) -> String {
    let micros = (u128::from(frames) * 1_000_000 + u128::from(CANONICAL_SAMPLE_RATE) / 2)
        / u128::from(CANONICAL_SAMPLE_RATE);
    format!("{}.{:06}", micros / 1_000_000, micros % 1_000_000)
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, path::Path};

    use super::{frames_to_seconds, session_arguments};
    use crate::media::audio_filters::pcm_cache::{FrameRange, RenderKey};

    #[test]
    fn seeks_and_bounds_input_by_exact_sample_positions() {
        assert_eq!(frames_to_seconds(6), "0.000125");
        assert_eq!(frames_to_seconds(48_006), "1.000125");
        let key = RenderKey {
            load_token: 1,
            stream_index: 3,
            graph: "aresample=48000:async=1:first_pts=0,highpass=f=80".to_owned(),
            range: FrameRange {
                start: 0,
                end: 240_000,
            },
            channels: 2,
        };
        let arguments = session_arguments(Path::new("C:\\Videos\\a b.mkv"), &key, 96_000);
        let pairs = arguments.windows(2).collect::<Vec<_>>();
        assert!(pairs.contains(&[OsString::from("-ss"), OsString::from("2.000000")].as_slice()));
        assert!(pairs.contains(&[OsString::from("-t"), OsString::from("3.000000")].as_slice()));
        assert!(pairs.contains(
            &[
                OsString::from("-filter_complex"),
                OsString::from(
                    "[0:3]aresample=48000:async=1:first_pts=0,highpass=f=80,apad=whole_len=144000,atrim=end_sample=144000[processed]"
                )
            ]
            .as_slice()
        ));
        assert_eq!(arguments.last(), Some(&OsString::from("pipe:1")));
    }
}
