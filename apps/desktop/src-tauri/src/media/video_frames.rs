//! Real video frames: the presentation timestamp of every displayed frame of a stream.
//!
//! Container metadata (stream/format duration, frame count) can disagree with the frames a
//! player actually shows: variable-rate captures skip frame slots, B-frame edit lists hide
//! leading frames, and audio can extend the container past the last picture. Reading packet
//! timestamps (no decoding) gives the frames exactly as players present them.

use std::{
    ffi::{OsStr, OsString},
    io,
    path::Path,
    time::Duration,
};

use crate::process::run_bounded_cancellable;

const FRAME_SCAN_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const FRAME_SCAN_STDOUT_LIMIT: usize = 256 * 1024 * 1024;
const FRAME_SCAN_STDERR_LIMIT: usize = 32 * 1024;
const MICROS_PER_SECOND: i128 = 1_000_000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VideoFrames {
    /// Presentation start of each displayed frame, relative to the container start, ascending.
    pub timestamps_micros: Vec<i64>,
    /// End of the last displayed frame: where the video's picture ends.
    pub end_micros: i64,
}

/// Why a scan produced no frames. Only cancellation must abort inspection; any other failure
/// leaves the caller with container metadata.
#[derive(Debug)]
pub enum FrameScanError {
    Cancelled,
    Unavailable,
}

pub fn scan_video_frames(
    path: &Path,
    stream_index: u32,
    time_base: &str,
    container_start_micros: i64,
    is_cancelled: impl FnMut() -> bool,
) -> Result<VideoFrames, FrameScanError> {
    let time_base = parse_time_base(time_base).ok_or(FrameScanError::Unavailable)?;
    let arguments = [
        OsString::from("-v"),
        OsString::from("error"),
        OsString::from("-select_streams"),
        OsString::from(stream_index.to_string()),
        OsString::from("-show_entries"),
        OsString::from("packet=pts,duration,flags"),
        OsString::from("-of"),
        OsString::from("csv=p=0"),
        path.as_os_str().to_owned(),
    ];

    let output = run_bounded_cancellable(
        OsStr::new("ffprobe"),
        &arguments,
        FRAME_SCAN_TIMEOUT,
        FRAME_SCAN_STDOUT_LIMIT,
        FRAME_SCAN_STDERR_LIMIT,
        is_cancelled,
    )
    .map_err(|error| match error.kind() {
        io::ErrorKind::Interrupted => FrameScanError::Cancelled,
        _ => FrameScanError::Unavailable,
    })?;

    if !output.status.success() || output.stdout_truncated {
        return Err(FrameScanError::Unavailable);
    }
    parse_packet_rows(&output.stdout, time_base, container_start_micros)
        .ok_or(FrameScanError::Unavailable)
}

/// Parses `pts,duration,flags` rows in the stream time base.
fn parse_packet_rows(
    output: &[u8],
    (numerator, denominator): (i128, i128),
    container_start_micros: i64,
) -> Option<VideoFrames> {
    let to_micros = |ticks: i128| -> Option<i64> {
        let scaled = ticks
            .checked_mul(numerator)?
            .checked_mul(MICROS_PER_SECOND)?;
        // Round half away from zero to the nearest microsecond, matching FFmpeg's rescaling.
        let rounded = if scaled >= 0 {
            (scaled + denominator / 2) / denominator
        } else {
            (scaled - denominator / 2) / denominator
        };
        i64::try_from(rounded).ok()
    };

    let mut frames: Vec<(i64, Option<i64>)> = Vec::new();
    for line in String::from_utf8_lossy(output).lines() {
        let mut fields = line.trim().split(',');
        let (Some(pts), duration, flags) = (fields.next(), fields.next(), fields.next()) else {
            continue;
        };
        // Packets the container marks as discarded (edit lists) are never displayed.
        if flags.is_some_and(|flags| flags.contains('D')) {
            continue;
        }
        let Ok(pts) = pts.parse::<i128>() else {
            continue;
        };
        let start = to_micros(pts)?.checked_sub(container_start_micros)?;
        if start < 0 {
            continue;
        }
        let duration = duration
            .and_then(|value| value.parse::<i128>().ok())
            .filter(|value| *value > 0)
            .and_then(to_micros);
        frames.push((start, duration));
    }

    frames.sort_unstable_by_key(|(start, _)| *start);
    frames.dedup_by_key(|(start, _)| *start);
    let (last_start, last_duration) = *frames.last()?;
    let timestamps_micros: Vec<i64> = frames.iter().map(|(start, _)| *start).collect();

    // Without a packet duration, the final frame lasts as long as the frame before it.
    let fallback_duration = timestamps_micros
        .len()
        .checked_sub(2)
        .map(|index| last_start - timestamps_micros[index])
        .filter(|gap| *gap > 0);
    let end_micros = last_start.checked_add(last_duration.or(fallback_duration)?)?;

    Some(VideoFrames {
        timestamps_micros,
        end_micros,
    })
}

fn parse_time_base(value: &str) -> Option<(i128, i128)> {
    let (numerator, denominator) = value.split_once('/')?;
    let numerator = numerator.trim().parse::<i128>().ok()?;
    let denominator = denominator.trim().parse::<i128>().ok()?;
    (numerator > 0 && denominator > 0).then_some((numerator, denominator))
}

#[cfg(test)]
mod tests {
    use super::{VideoFrames, parse_packet_rows, parse_time_base};

    #[test]
    fn keeps_real_frames_and_ends_after_the_last_one() {
        // OBS MKV: millisecond ticks with two skipped 60 FPS slots before the final frame.
        let rows = b"0,17,K__\n17,16,___\n1383,17,___\n1400,17,___\n1450,17,___\n";
        assert_eq!(
            parse_packet_rows(rows, (1, 1000), 0),
            Some(VideoFrames {
                timestamps_micros: vec![0, 17_000, 1_383_000, 1_400_000, 1_450_000],
                end_micros: 1_467_000,
            })
        );
    }

    #[test]
    fn orders_reordered_packets_and_skips_discarded_ones() {
        // HEVC MP4 in decode order: B-frames precede their display order and the edit list
        // discards a leading frame.
        let rows = b"-256,256,_D_\n0,256,K__\n768,256,___\n256,256,___\n512,256,___\n";
        let frames = parse_packet_rows(rows, (1, 15360), 0).unwrap();
        assert_eq!(frames.timestamps_micros, vec![0, 16_667, 33_333, 50_000]);
        assert_eq!(frames.end_micros, 66_667);
    }

    #[test]
    fn measures_frames_from_the_container_start() {
        let rows = b"1000,40,K__\n1040,40,___\n";
        let frames = parse_packet_rows(rows, (1, 1000), 1_000_000).unwrap();
        assert_eq!(frames.timestamps_micros, vec![0, 40_000]);
        assert_eq!(frames.end_micros, 80_000);
    }

    #[test]
    fn falls_back_to_the_previous_gap_without_a_final_duration() {
        let rows = b"0,N/A,K__\n33,N/A,___\n67,N/A,___\n";
        let frames = parse_packet_rows(rows, (1, 1000), 0).unwrap();
        assert_eq!(frames.end_micros, 101_000);
    }

    #[test]
    fn reports_no_frames_for_unusable_output() {
        assert_eq!(parse_packet_rows(b"", (1, 1000), 0), None);
        assert_eq!(parse_packet_rows(b"N/A,N/A,___\n", (1, 1000), 0), None);
        assert_eq!(parse_packet_rows(b"0,N/A,K__\n", (1, 1000), 0), None);
        assert_eq!(parse_time_base("0/1"), None);
        assert_eq!(parse_time_base("1/15360"), Some((1, 15360)));
    }
}
