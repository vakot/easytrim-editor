use std::{
    fs,
    io::{self, Write},
    process,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    error::{AppError, AppErrorMessageId},
    media::{
        audio::processed_timeline_range,
        audio_filters::{
            compiler::CompiledChain,
            engine::{AudioProcessingEngine, RenderRequest},
        },
    },
    state::{WaveformArtifact, WaveformSource},
};

pub const MIN_WAVEFORM_WIDTH: u32 = 64;
pub const MAX_WAVEFORM_WIDTH: u32 = 4_096;
const WAVEFORM_FORMAT_VERSION: u16 = 2;
const WAVEFORM_HEADER_SIZE: usize = 12;
const WAVEFORM_FLAG_RLE: u16 = 1;
const PCM_BLOCK_FRAMES: u64 = 48_000;
const AUDIO_ACTIVITY_THRESHOLD_DB: f64 = -50.0;
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);
pub type WaveformGenerationResult = (u32, Option<bool>, Result<WaveformArtifact, AppError>);

/// Reduces the same full-timeline, pre-Track-Volume PCM used by playback. The compiled chain
/// already contains the measurements for every global-analysis stage. Chunk boundaries never
/// restart stateful filters, and provisional playback-seek samples are not authoritative here.
pub fn generate_waveforms(
    engine: &AudioProcessingEngine,
    source: &WaveformSource,
    stream_indexes: &[u32],
    width: u32,
    chain_by_stream: &std::collections::HashMap<u32, CompiledChain>,
) -> Result<Vec<WaveformGenerationResult>, AppError> {
    for stream_index in stream_indexes {
        validate_waveform_request(&source.source.audio_stream_indexes, *stream_index, width)?;
    }
    let media = source.source.media.as_ref().ok_or_else(|| {
        AppError::invalid_request(
            AppErrorMessageId::MediaAudioStreamMetadataIsUnavailableForWaveformGeneration,
        )
    })?;
    let range = processed_timeline_range(media);
    let frames = range.end - range.start;
    if frames < u64::from(width) {
        return Err(AppError::waveform_failed(
            AppErrorMessageId::MediaWaveformTooFewSamples,
            None::<String>,
        ));
    }
    let mut results = Vec::with_capacity(stream_indexes.len());
    for &stream_index in stream_indexes {
        let chain = chain_by_stream.get(&stream_index).ok_or_else(|| {
            AppError::invalid_request(
                AppErrorMessageId::MediaWaveformProcessingSettingsMustMatchTheSelectedAudioStreams,
            )
        })?;
        let result = (|| {
            let artifact = create_artifact(stream_index)?;
            let mut reducer = EnvelopeReducer::new(frames, width);
            let mut start = range.start;
            while start < range.end {
                let count = (range.end - start).min(PCM_BLOCK_FRAMES);
                let samples = engine.render_canonical(
                    &RenderRequest {
                        source: &source.source,
                        stream_index,
                        chain,
                        range,
                        start,
                        frames: count,
                        channels: 2,
                    },
                    &|| waveform_cancelled(source),
                )?;
                reducer.push(&samples);
                start += count;
            }
            if waveform_cancelled(source) {
                return Err(AppError::cancelled(
                    AppErrorMessageId::MediaWaveformWaveformGenerationWasReplaced,
                ));
            }
            let mut output = fs::File::create(artifact.path()).map_err(envelope_error)?;
            reducer.write(&mut output).map_err(envelope_error)?;
            Ok((artifact, reducer.has_signal()))
        })();
        results.push(match result {
            Ok((artifact, has_signal)) => (stream_index, Some(has_signal), Ok(artifact)),
            Err(error) => (stream_index, None, Err(error)),
        });
    }
    Ok(results)
}

fn waveform_cancelled(source: &WaveformSource) -> bool {
    source.source.cancellation.load(Ordering::Acquire)
        || source.cancellation.load(Ordering::Acquire)
}

/// Column c spans [c * frames / width, (c + 1) * frames / width). Accumulate float peaks
/// and RMS before quantizing so above-full-scale samples are not clipped before averaging.
struct EnvelopeReducer {
    frames: u64,
    width: u32,
    position: u64,
    column: u64,
    squares: [f64; 2],
    peaks: [f64; 2],
    mono_squares: f64,
    envelope: Vec<u8>,
}

impl EnvelopeReducer {
    fn new(frames: u64, width: u32) -> Self {
        Self {
            frames,
            width,
            position: 0,
            column: 0,
            squares: [0.0; 2],
            peaks: [0.0; 2],
            mono_squares: 0.0,
            envelope: Vec::with_capacity(width as usize * 4),
        }
    }

    fn push(&mut self, samples: &[f32]) {
        for frame in samples.chunks_exact(2) {
            for (channel, &value) in frame.iter().enumerate() {
                let magnitude = f64::from(value).abs();
                self.peaks[channel] = self.peaks[channel].max(magnitude);
                self.squares[channel] += magnitude * magnitude;
            }
            let mono = (f64::from(frame[0]) + f64::from(frame[1])) * 0.5;
            self.mono_squares += mono * mono;
            self.position += 1;
            let end = (self.column + 1) * self.frames / u64::from(self.width);
            if self.position == end {
                let start = self.column * self.frames / u64::from(self.width);
                for channel in 0..2 {
                    let rms = (self.squares[channel] / (end - start) as f64).sqrt();
                    self.envelope.push(scale_amplitude(self.peaks[channel]));
                    self.envelope.push(scale_amplitude(rms));
                }
                self.column += 1;
                self.peaks = [0.0; 2];
                self.squares = [0.0; 2];
            }
        }
    }

    fn has_signal(&self) -> bool {
        10.0 * (self.mono_squares / self.frames as f64).log10() >= AUDIO_ACTIVITY_THRESHOLD_DB
    }

    fn write(&self, writer: &mut dyn Write) -> io::Result<()> {
        if self.position != self.frames || self.column != u64::from(self.width) {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "incomplete processed waveform",
            ));
        }
        let encoded = encode_rle(&self.envelope);
        let flags = if encoded.len() < self.envelope.len() {
            WAVEFORM_FLAG_RLE
        } else {
            0
        };
        write_envelope_header(writer, self.width, flags)?;
        writer.write_all(if flags == WAVEFORM_FLAG_RLE {
            &encoded
        } else {
            &self.envelope
        })?;
        writer.flush()
    }
}

fn scale_amplitude(amplitude: f64) -> u8 {
    (amplitude * f64::from(u8::MAX)).round() as u8
}

fn envelope_error(_: io::Error) -> AppError {
    AppError::waveform_failed(
        AppErrorMessageId::MediaWaveformSampleReductionFailed,
        None::<String>,
    )
}

pub fn validate_waveform_request(
    audio_stream_indexes: &[u32],
    stream_index: u32,
    width: u32,
) -> Result<(), AppError> {
    if !(MIN_WAVEFORM_WIDTH..=MAX_WAVEFORM_WIDTH).contains(&width) {
        return Err(
            AppError::invalid_request(AppErrorMessageId::MediaWaveformWidthOutOfRange)
                .with_arg("minWidth", MIN_WAVEFORM_WIDTH)
                .with_arg("maxWidth", MAX_WAVEFORM_WIDTH),
        );
    }
    if !audio_stream_indexes.contains(&stream_index) {
        return Err(AppError::invalid_request(
            AppErrorMessageId::MediaWaveformStreamDoesNotBelongToSource,
        )
        .with_arg("streamIndex", stream_index));
    }
    Ok(())
}

fn write_envelope_header(writer: &mut dyn Write, width: u32, flags: u16) -> io::Result<()> {
    let mut header = [0; WAVEFORM_HEADER_SIZE];
    header[..4].copy_from_slice(b"ETWF");
    header[4..6].copy_from_slice(&WAVEFORM_FORMAT_VERSION.to_le_bytes());
    header[6..8].copy_from_slice(&flags.to_le_bytes());
    header[8..].copy_from_slice(&width.to_le_bytes());
    writer.write_all(&header)
}

fn encode_rle(samples: &[u8]) -> Vec<u8> {
    let mut encoded = Vec::with_capacity(samples.len());
    let mut position = 0;
    while position < samples.len() {
        let run_length = repeated_sample_count(samples, position);
        if run_length >= 3 {
            encoded.push(0x80 | (run_length - 1) as u8);
            encoded.push(samples[position]);
            position += run_length;
            continue;
        }

        let literal_start = position;
        position += run_length;
        while position < samples.len() && position - literal_start < 128 {
            let next_run_length = repeated_sample_count(samples, position);
            if next_run_length >= 3 {
                break;
            }
            position += next_run_length.min(128 - (position - literal_start));
        }
        let literal_length = position - literal_start;
        encoded.push((literal_length - 1) as u8);
        encoded.extend_from_slice(&samples[literal_start..position]);
    }
    encoded
}

fn repeated_sample_count(samples: &[u8], start: usize) -> usize {
    let value = samples[start];
    samples[start..]
        .iter()
        .take_while(|sample| **sample == value)
        .take(128)
        .count()
}

fn create_artifact(stream_index: u32) -> Result<WaveformArtifact, AppError> {
    create_temporary_artifact(stream_index, "etwf")
}

fn create_temporary_artifact(
    stream_index: u32,
    extension: &str,
) -> Result<WaveformArtifact, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let base_directory = std::env::temp_dir();

    for _ in 0..100 {
        let sequence = NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
        let directory = base_directory.join(format!(
            "easytrim-waveform-{}-{timestamp}-{sequence}",
            process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => {
                let path = directory.join(format!("audio-{stream_index}.{extension}"));
                return WaveformArtifact::new(directory, path);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(_) => {
                return Err(AppError::io_failed(
                    AppErrorMessageId::MediaWaveformTemporaryWaveformDirectoryCouldNotBeCreated,
                ));
            }
        }
    }

    Err(AppError::io_failed(
        AppErrorMessageId::MediaWaveformUniqueTemporaryWaveformDirectoryCouldNotBeCreated,
    ))
}

#[cfg(test)]
mod tests {
    use super::{EnvelopeReducer, encode_rle, write_envelope_header};

    use crate::{
        media::{
            audio_filters::{
                analysis::{LoudnessAnalysisRequest, analyze_chain_loudness},
                compiler::compile_chain,
                engine::AudioProcessingEngine,
                model::{AudioChainSelection, fixtures::*},
                test_fixtures::{
                    PROGRAM_MATERIAL, decode_f32_stereo, fixture_source, generate_fixture,
                },
            },
            export::TrimSelection,
        },
        state::WaveformSource,
    };
    use std::{
        ffi::OsString,
        sync::{Arc, atomic::AtomicBool},
    };

    fn values(bytes: &[u8]) -> Vec<u8> {
        let width = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
        if u16::from_le_bytes(bytes[6..8].try_into().unwrap()) == super::WAVEFORM_FLAG_RLE {
            decode_rle(&bytes[12..], width * 4)
        } else {
            bytes[12..].to_vec()
        }
    }

    #[test]
    fn complete_chain_matches_continuous_pcm_with_trimmed_normalization_dependencies() {
        let file = generate_fixture("waveform-chain", PROGRAM_MATERIAL, "wav", "pcm_s16le");
        let source = WaveformSource {
            source: fixture_source(file.path(), 8_000_000),
            cancellation: Arc::new(AtomicBool::new(false)),
        };
        let engine = AudioProcessingEngine::default();
        let chains = [
            vec![],
            vec![gain("gain", 6.0)],
            vec![
                gain("gain", 6.0),
                limiter("lim", -12.0),
                high_pass("late", 800.0),
                noise_reduction("nr"),
            ],
            vec![
                limiter("lim", -12.0),
                gain("gain", 6.0),
                high_pass("late", 800.0),
                noise_reduction("nr"),
            ],
            vec![
                gain("pre", -6.0),
                normalization("first", -23.0),
                gain("mid", 3.0),
                normalization("second", -16.0),
            ],
        ];
        let mut envelopes = Vec::new();
        for filters in chains {
            let measurements = analyze_chain_loudness(
                &source.source,
                &LoudnessAnalysisRequest {
                    trim: TrimSelection {
                        start_micros: 1_000_000,
                        end_micros: 6_000_000,
                    },
                    audio_track: AudioChainSelection {
                        stream_index: 0,
                        filters: filters.clone(),
                        loudness_measurements: vec![],
                    },
                },
                &source.cancellation,
                engine.measurements(),
            )
            .unwrap();
            let chain = compile_chain(&filters, &measurements).unwrap();
            let reference = decode_f32_stereo(&[
                OsString::from("-i"),
                file.path().as_os_str().to_owned(),
                OsString::from("-t"),
                OsString::from("8"),
                OsString::from("-af"),
                OsString::from(format!(
                    "{},apad=whole_len=384000,atrim=end_sample=384000",
                    chain.canonical_graph()
                )),
            ]);
            let mut expected = EnvelopeReducer::new(384_000, 128);
            expected.push(&reference);
            let result = super::generate_waveforms(
                &engine,
                &source,
                &[0],
                128,
                &[(0, chain)].into_iter().collect(),
            )
            .unwrap();
            let actual = values(&std::fs::read(result[0].2.as_ref().unwrap().path()).unwrap());
            assert_eq!(actual, expected.envelope);
            assert_eq!(result[0].1, Some(true));
            envelopes.push(actual);
        }
        for pair in envelopes.windows(2) {
            assert_ne!(pair[0], pair[1]);
        }
    }

    #[test]
    fn delayed_stream_keeps_leading_and_trailing_silence_on_the_source_timeline() {
        let file = super::create_artifact(0).unwrap();
        let mut args: Vec<OsString> = [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=s=16x16:r=10:d=3",
            "-itsoffset",
            "0.5",
            "-f",
            "lavfi",
            "-i",
            "aevalsrc=0.25:s=48000:d=2:c=stereo",
            "-map",
            "1:a",
            "-map",
            "0:v",
            "-c:a",
            "pcm_f32le",
            "-c:v",
            "ffv1",
            "-f",
            "matroska",
        ]
        .iter()
        .map(OsString::from)
        .collect();
        args.push(file.path().as_os_str().to_owned());
        let output = crate::process::run_bounded(
            std::ffi::OsStr::new("ffmpeg"),
            &args,
            std::time::Duration::from_secs(30),
            0,
            16384,
        )
        .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let source = WaveformSource {
            source: fixture_source(file.path(), 3_000_000),
            cancellation: Arc::new(AtomicBool::new(false)),
        };
        let chain = compile_chain(&[gain("gain", 6.0)], &[]).unwrap();
        let engine = AudioProcessingEngine::default();
        let result = super::generate_waveforms(
            &engine,
            &source,
            &[0],
            120,
            &[(0, chain)].into_iter().collect(),
        )
        .unwrap();
        let bins = values(&std::fs::read(result[0].2.as_ref().unwrap().path()).unwrap());
        assert!(bins[..20 * 4].iter().all(|&value| value == 0));
        assert!(bins[21 * 4..99 * 4].iter().all(|&value| value >= 126));
        assert!(bins[101 * 4..].iter().all(|&value| value == 0));
    }

    #[test]
    fn validates_stream_and_width_and_rejects_cancelled_work() {
        assert!(super::validate_waveform_request(&[2, 4], 2, 1200).is_ok());
        assert!(super::validate_waveform_request(&[2], 4, 1200).is_err());
        assert!(super::validate_waveform_request(&[2], 2, 63).is_err());
        assert!(super::validate_waveform_request(&[2], 2, 4097).is_err());
        let source = WaveformSource {
            source: fixture_source(std::path::Path::new("must-not-open.wav"), 1_000_000),
            cancellation: Arc::new(AtomicBool::new(true)),
        };
        let result = super::generate_waveforms(
            &AudioProcessingEngine::default(),
            &source,
            &[0],
            64,
            &[(0, compile_chain(&[], &[]).unwrap())]
                .into_iter()
                .collect(),
        )
        .unwrap();
        assert!(result[0].2.is_err());
    }

    #[test]
    fn float_binning_preserves_unclipped_rms_and_uneven_column_alignment() {
        let mut reducer = EnvelopeReducer::new(10, 4);
        let mut samples = [0.0_f32; 20];
        samples[10] = 2.0;
        // Split inside a bin to exercise streaming boundaries.
        reducer.push(&samples[..12]);
        reducer.push(&samples[12..]);
        assert_eq!(
            reducer.envelope,
            [0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0]
        );
        assert!(reducer.has_signal());
        assert!(reducer.write(&mut Vec::new()).is_ok());
    }

    #[test]
    fn writes_versioned_width_header_before_unsigned_amplitudes() {
        let mut output = Vec::new();
        write_envelope_header(&mut output, 1_280, 0).expect("header is written");
        assert_eq!(&output[..4], b"ETWF");
        assert_eq!(u16::from_le_bytes([output[4], output[5]]), 2);
        assert_eq!(u16::from_le_bytes(output[6..8].try_into().unwrap()), 0);
        assert_eq!(u32::from_le_bytes(output[8..12].try_into().unwrap()), 1_280);
        assert_eq!(output.len(), super::WAVEFORM_HEADER_SIZE);
    }

    #[test]
    fn compresses_repeated_envelope_samples_without_expanding_literals() {
        assert_eq!(encode_rle(&[0, 0, 0, 0, 0]), [0x84, 0]);
        assert_eq!(encode_rle(&[1, 2, 3]), [2, 1, 2, 3]);
    }

    fn decode_rle(samples: &[u8], expected_len: usize) -> Vec<u8> {
        let mut decoded = Vec::with_capacity(expected_len);
        let mut position = 0;
        while position < samples.len() {
            let token = samples[position];
            position += 1;
            let length = usize::from(token & 0x7f) + 1;
            if token & 0x80 != 0 {
                let value = samples[position];
                position += 1;
                decoded.extend(std::iter::repeat_n(value, length));
            } else {
                decoded.extend_from_slice(&samples[position..position + length]);
                position += length;
            }
        }
        assert_eq!(decoded.len(), expected_len);
        decoded
    }
}
