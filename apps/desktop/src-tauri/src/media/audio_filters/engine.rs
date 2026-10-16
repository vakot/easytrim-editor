use std::{
    collections::HashMap,
    io,
    sync::{
        Arc, Mutex, MutexGuard,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

use crate::{
    error::{AppError, AppErrorMessageId},
    process::ChildTerminator,
    state::ActiveSource,
};

use super::{
    analysis::MeasurementCache,
    compiler::CompiledChain,
    pcm_cache::{
        CoveragePart, FrameRange, MAX_SEGMENT_FRAMES, PcmCache, PcmQuality, RenderKey,
        read_segment_frames, write_segment_file,
    },
    session::{RenderSession, SEEK_GRID_FRAMES},
};

/// Bounds a single request so its response stays small enough for one IPC message.
const MAX_REQUEST_FRAMES: u64 = 10 * 48_000;
const MAX_CHANNELS: u16 = 8;

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub cache_limit_bytes: u64,
    /// A request at most this far after the range origin renders continuously from the origin,
    /// which makes its output canonical at the cost of extra latency.
    pub canonical_catchup_frames: u64,
    /// A running session continues through a gap of at most this many frames to reach a request.
    pub continuation_window_frames: u64,
    pub max_sessions: usize,
    pub session_idle_timeout: Duration,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            // About 46 minutes of stereo float audio.
            cache_limit_bytes: 1024 * 1024 * 1024,
            canonical_catchup_frames: 10 * 48_000,
            continuation_window_frames: 10 * 48_000,
            max_sessions: 4,
            session_idle_timeout: Duration::from_secs(60),
        }
    }
}

/// A range of processed audio to produce for one consumer of a source stream.
pub struct RenderRequest<'a> {
    pub source: &'a ActiveSource,
    pub stream_index: u32,
    pub chain: &'a CompiledChain,
    /// The continuous rendering range. Canonical samples equal one render of this whole range.
    pub range: FrameRange,
    pub start: u64,
    pub frames: u64,
    pub channels: u16,
}

/// The demand-driven renderer for processed track audio.
///
/// It serves requested frame ranges from the disk cache and renders only the missing parts,
/// through persistent FFmpeg sessions that keep stateful filters continuous. Each source stream is
/// one scope: a request for a different chain supersedes the previous one, terminating its
/// sessions and rejecting its results, so stale revisions never reach the cache or the caller.
pub struct AudioProcessingEngine {
    config: EngineConfig,
    state: Mutex<EngineState>,
    measurements: MeasurementCache,
}

struct EngineState {
    cache: PcmCache,
    sessions: Vec<SessionSlot>,
    scopes: HashMap<RenderScope, ScopeState>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct RenderScope {
    load_token: u64,
    stream_index: u32,
}

struct ScopeState {
    key: RenderKey,
    generation: u64,
}

/// Everything a request needs to render and commit gaps: what to render and which revision of
/// its scope it belongs to.
struct RenderTarget<'a> {
    request: &'a RenderRequest<'a>,
    key: RenderKey,
    scope: RenderScope,
    generation: u64,
}

struct SessionSlot {
    key: RenderKey,
    session: Arc<Mutex<RenderSession>>,
    terminator: ChildTerminator,
    /// The session's cursor, readable without waiting for a request that is using the session.
    cursor: Arc<AtomicU64>,
    committed_from: u64,
    last_used: Instant,
}

impl SessionSlot {
    fn terminate(&self) {
        self.terminator.terminate();
    }
}

impl Default for AudioProcessingEngine {
    fn default() -> Self {
        Self::new(EngineConfig::default())
    }
}

impl std::fmt::Debug for AudioProcessingEngine {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AudioProcessingEngine")
            .field("config", &self.config)
            .finish_non_exhaustive()
    }
}

impl AudioProcessingEngine {
    pub fn new(config: EngineConfig) -> Self {
        Self {
            state: Mutex::new(EngineState {
                cache: PcmCache::new(config.cache_limit_bytes),
                sessions: Vec::new(),
                scopes: HashMap::new(),
            }),
            config,
            measurements: MeasurementCache::default(),
        }
    }

    pub fn measurements(&self) -> &MeasurementCache {
        &self.measurements
    }

    /// Returns interleaved f32 frames for `[start, start + frames)` and whether every frame is
    /// canonical.
    pub fn render(
        &self,
        request: &RenderRequest<'_>,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<(Vec<f32>, PcmQuality), AppError> {
        validate_request(request)?;
        let key = RenderKey {
            load_token: request.source.load_token,
            stream_index: request.stream_index,
            graph: request.chain.canonical_graph(),
            range: request.range,
            channels: request.channels,
        };
        let scope = RenderScope {
            load_token: key.load_token,
            stream_index: key.stream_index,
        };
        let generation = self.begin(scope, &key)?;
        let target = RenderTarget {
            request,
            key,
            scope,
            generation,
        };
        let end = request.start + request.frames;
        let channels = usize::from(request.channels);
        let mut output = vec![0.0_f32; request.frames as usize * channels];
        let mut quality = PcmQuality::Canonical;
        let mut position = request.start;

        while position < end {
            let part = self
                .lock()?
                .cache
                .plan(&target.key, position, end)
                .into_iter()
                .next()
                .expect("a coverage plan covers its range");
            let (gap_start, gap_end) = match part {
                CoveragePart::Cached {
                    start,
                    end: part_end,
                    quality: cached_quality,
                    path,
                    segment_start,
                } => {
                    let offset = (start - request.start) as usize * channels;
                    let length = (part_end - start) as usize * channels;
                    if read_segment_frames(
                        &path,
                        start - segment_start,
                        request.channels,
                        &mut output[offset..offset + length],
                    )
                    .is_ok()
                    {
                        if cached_quality == PcmQuality::Provisional {
                            quality = PcmQuality::Provisional;
                        }
                        position = part_end;
                        continue;
                    }
                    // The segment was evicted after planning; render its frames instead.
                    (start, part_end)
                }
                CoveragePart::Missing { start, end } => (start, end),
            };
            if self.render_gap(&target, gap_start, gap_end, &mut output, is_cancelled)?
                == PcmQuality::Provisional
            {
                quality = PcmQuality::Provisional;
            }
            position = gap_end;
        }

        self.ensure_current(target.scope, target.generation)?;
        Ok((output, quality))
    }

    /// Drops every session, cached sample, and measurement of a replaced source activation.
    pub fn release_source(&self, load_token: u64) {
        if let Ok(mut state) = self.state.lock() {
            state.sessions.retain(|slot| {
                let keep = slot.key.load_token != load_token;
                if !keep {
                    slot.terminate();
                }
                keep
            });
            state
                .scopes
                .retain(|scope, _| scope.load_token != load_token);
            state.cache.remove_source(load_token);
        }
        self.measurements.remove_source(load_token);
    }

    /// Registers the request's key as the scope's current revision. A different key supersedes
    /// the previous revision and stops its sessions.
    fn begin(&self, scope: RenderScope, key: &RenderKey) -> Result<u64, AppError> {
        let mut state = self.lock()?;
        let idle_timeout = self.config.session_idle_timeout;
        state.sessions.retain(|slot| {
            let keep = slot.last_used.elapsed() < idle_timeout;
            if !keep {
                slot.terminate();
            }
            keep
        });
        let generation = match state.scopes.get_mut(&scope) {
            Some(current) if current.key == *key => current.generation,
            Some(current) => {
                current.key = key.clone();
                current.generation += 1;
                current.generation
            }
            None => {
                state.scopes.insert(
                    scope,
                    ScopeState {
                        key: key.clone(),
                        generation: 0,
                    },
                );
                0
            }
        };
        state.sessions.retain(|slot| {
            let superseded = slot.key.load_token == scope.load_token
                && slot.key.stream_index == scope.stream_index
                && slot.key != *key;
            if superseded {
                slot.terminate();
            }
            !superseded
        });
        Ok(generation)
    }

    fn ensure_current(&self, scope: RenderScope, generation: u64) -> Result<(), AppError> {
        let state = self.lock()?;
        match state.scopes.get(&scope) {
            Some(current) if current.generation == generation => Ok(()),
            _ => Err(superseded()),
        }
    }

    /// Renders `[start, end)` through a session, caching every committed segment it produces
    /// and copying the requested frames into `output`.
    fn render_gap(
        &self,
        target: &RenderTarget<'_>,
        start: u64,
        end: u64,
        output: &mut [f32],
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<PcmQuality, AppError> {
        let RenderTarget {
            request,
            key,
            scope,
            generation,
        } = target;
        let (scope, generation) = (*scope, *generation);
        let mut slot = self.session_for(request, key, start, false)?;
        let mut session = slot.0.lock().map_err(|_| session_unavailable())?;
        if session.cursor > start {
            // Another request advanced the session past this gap without caching it.
            drop(session);
            slot = self.session_for(request, key, start, true)?;
            session = slot.0.lock().map_err(|_| session_unavailable())?;
        }
        let (session_handle, cursor) = &slot;
        let channels = usize::from(key.channels);
        let cancelled = || is_cancelled() || request.source.cancellation.load(Ordering::Acquire);

        while session.cursor < end {
            let position = session.cursor;
            if position < session.committed_from {
                let warmup = (session.committed_from - position).min(MAX_SEGMENT_FRAMES);
                let read = session.read_frames(warmup, cancelled);
                cursor.store(session.cursor, Ordering::Release);
                read.map_err(|error| self.render_error(error, scope, generation, session_handle))?;
                continue;
            }
            // Segments end at the gap start and end so requested frames are never split.
            let boundary = if position < start { start } else { end };
            let frames = (boundary - position).min(MAX_SEGMENT_FRAMES);
            let read = session.read_frames(frames, cancelled);
            cursor.store(session.cursor, Ordering::Release);
            let samples =
                read.map_err(|error| self.render_error(error, scope, generation, session_handle))?;
            self.store_segment(target, position, frames, session.quality, &samples)?;

            let copy_start = position.max(start);
            let copy_end = (position + frames).min(end);
            if copy_start < copy_end {
                let source_offset = (copy_start - position) as usize * channels;
                let target_offset = (copy_start - request.start) as usize * channels;
                let length = (copy_end - copy_start) as usize * channels;
                output[target_offset..target_offset + length]
                    .copy_from_slice(&samples[source_offset..source_offset + length]);
            }
        }
        Ok(session.quality)
    }

    /// Chooses the session that will render a gap starting at `start`: a running session of the
    /// key that is shortly behind it, or a new one. A new session renders from the range origin
    /// when that is close enough, which makes it canonical; otherwise it seeks with the chain's
    /// warm-up and its output stays provisional.
    fn session_for(
        &self,
        request: &RenderRequest<'_>,
        key: &RenderKey,
        start: u64,
        force_new: bool,
    ) -> Result<(Arc<Mutex<RenderSession>>, Arc<AtomicU64>), AppError> {
        let mut state = self.lock()?;
        if !force_new
            && let Some(slot) = state.sessions.iter_mut().find(|slot| {
                let cursor = slot.cursor.load(Ordering::Acquire);
                slot.key == *key
                    && slot.committed_from <= start
                    && cursor <= start
                    && start - cursor <= self.config.continuation_window_frames
            })
        {
            slot.last_used = Instant::now();
            return Ok((Arc::clone(&slot.session), Arc::clone(&slot.cursor)));
        }

        let origin = key.range.start;
        let (seek_frame, committed_from) = if start - origin <= self.config.canonical_catchup_frames
        {
            (origin, origin)
        } else {
            let preroll = request.chain.strategy().provisional_preroll_frames();
            let seek = start.saturating_sub(preroll).max(origin);
            let seek = origin + (seek - origin) / SEEK_GRID_FRAMES * SEEK_GRID_FRAMES;
            (seek, if seek == origin { origin } else { start })
        };
        let quality = if seek_frame == origin {
            PcmQuality::Canonical
        } else {
            PcmQuality::Provisional
        };
        let session = RenderSession::start(
            &request.source.path,
            key,
            seek_frame,
            committed_from,
            quality,
        )
        .map_err(start_error)?;

        if state.sessions.len() >= self.config.max_sessions
            && let Some(oldest) = state
                .sessions
                .iter()
                .enumerate()
                .min_by_key(|(_, slot)| slot.last_used)
                .map(|(index, _)| index)
        {
            state.sessions.remove(oldest).terminate();
        }
        let cursor = Arc::new(AtomicU64::new(seek_frame));
        let slot = SessionSlot {
            key: key.clone(),
            terminator: session.terminator(),
            session: Arc::new(Mutex::new(session)),
            cursor: Arc::clone(&cursor),
            committed_from,
            last_used: Instant::now(),
        };
        let handles = (Arc::clone(&slot.session), cursor);
        state.sessions.push(slot);
        Ok(handles)
    }

    /// Writes a segment outside the engine lock and indexes it only if its revision is current.
    fn store_segment(
        &self,
        target: &RenderTarget<'_>,
        start: u64,
        frames: u64,
        quality: PcmQuality,
        samples: &[f32],
    ) -> Result<(), AppError> {
        let path = self.lock()?.cache.reserve_file().map_err(cache_error)?;
        write_segment_file(&path, samples).map_err(cache_error)?;
        let mut state = self.lock()?;
        if state
            .scopes
            .get(&target.scope)
            .is_none_or(|current| current.generation != target.generation)
        {
            let _ = std::fs::remove_file(&path);
            return Err(superseded());
        }
        state
            .cache
            .commit(&target.key, start, frames, quality, path)
            .map_err(cache_error)
    }

    /// Classifies a session failure. A cancelled read leaves the session consistent and reusable;
    /// any other failure discards it so the next request starts a new one.
    fn render_error(
        &self,
        error: io::Error,
        scope: RenderScope,
        generation: u64,
        session: &Arc<Mutex<RenderSession>>,
    ) -> AppError {
        if self.ensure_current(scope, generation).is_err() {
            return superseded();
        }
        if error.kind() == io::ErrorKind::Interrupted {
            return AppError::cancelled(
                AppErrorMessageId::MediaAudioProcessedAudioRenderWasCancelled,
            );
        }
        if let Ok(mut state) = self.state.lock() {
            state.sessions.retain(|slot| {
                let failed = Arc::ptr_eq(&slot.session, session);
                if failed {
                    slot.terminate();
                }
                !failed
            });
        }
        match error.kind() {
            io::ErrorKind::TimedOut => AppError::preview_failed(
                AppErrorMessageId::MediaAudioPlaybackAudioDecodingTookTooLong,
                None::<String>,
            ),
            _ => AppError::preview_failed(
                AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
                Some(error.to_string()),
            ),
        }
    }

    fn lock(&self) -> Result<MutexGuard<'_, EngineState>, AppError> {
        self.state
            .lock()
            .map_err(|_| AppError::internal("The audio processing engine is unavailable."))
    }
}

impl Drop for AudioProcessingEngine {
    fn drop(&mut self) {
        if let Ok(state) = self.state.get_mut() {
            for slot in &state.sessions {
                slot.terminate();
            }
        }
    }
}

fn validate_request(request: &RenderRequest<'_>) -> Result<(), AppError> {
    let end = request.start.checked_add(request.frames);
    if request.frames == 0
        || request.frames > MAX_REQUEST_FRAMES
        || request.channels == 0
        || request.channels > MAX_CHANNELS
        || !request.range.start.is_multiple_of(SEEK_GRID_FRAMES)
        || request.start < request.range.start
        || end.is_none_or(|end| end > request.range.end)
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::ExportSelectedExportRangeIsInvalid,
        ));
    }
    Ok(())
}

fn superseded() -> AppError {
    AppError::cancelled(AppErrorMessageId::MediaAudioProcessingChangedBeforeAudioWasReady)
}

fn session_unavailable() -> AppError {
    AppError::internal("A processed audio session is unavailable.")
}

fn start_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::NotFound => AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegIsRequiredForPlayback,
            None::<String>,
        ),
        _ => AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
            Some(error.to_string()),
        ),
    }
}

fn cache_error(error: io::Error) -> AppError {
    AppError::internal(format!("Processed audio could not be cached: {error}"))
}

#[cfg(test)]
mod tests {
    use std::{
        ffi::OsString,
        sync::{
            Arc, Mutex,
            atomic::{AtomicBool, Ordering},
            mpsc,
        },
        thread,
        time::Duration,
    };

    use super::{AudioProcessingEngine, EngineConfig, RenderRequest};
    use crate::{
        error::{AppError, AppErrorMessageId},
        media::audio_filters::{
            compiler::{CompiledChain, compile_chain},
            model::{AudioFilter, fixtures::*},
            pcm_cache::{FrameRange, PcmQuality},
            test_fixtures::{
                FixtureFile, PROGRAM_MATERIAL, decode_f32_stereo, fixture_source, generate_fixture,
                max_difference,
            },
        },
        state::ActiveSource,
    };

    const RANGE: FrameRange = FrameRange {
        start: 0,
        end: 8 * 48_000,
    };

    fn stateful_chain() -> CompiledChain {
        compile_chain(
            &[
                high_pass("hp", 80.0),
                noise_reduction("nr"),
                gain("g", 9.0),
                limiter("lim", -3.0),
            ],
            &[],
        )
        .unwrap()
    }

    fn program() -> (FixtureFile, ActiveSource) {
        let fixture = generate_fixture("engine", PROGRAM_MATERIAL, "wav", "pcm_s16le");
        let source = fixture_source(fixture.path(), 8_000_000);
        (fixture, source)
    }

    /// The canonical definition: one continuous render of the whole range, as an export does.
    fn continuous_reference(source: &ActiveSource, chain: &CompiledChain) -> Vec<f32> {
        let length = RANGE.end;
        decode_f32_stereo(&[
            OsString::from("-i"),
            source.path.as_os_str().to_owned(),
            OsString::from("-t"),
            OsString::from("8.000000"),
            OsString::from("-filter_complex"),
            OsString::from(format!(
                "[0:0]{},apad=whole_len={length},atrim=end_sample={length}[out]",
                chain.canonical_graph()
            )),
            OsString::from("-map"),
            OsString::from("[out]"),
        ])
    }

    fn render(
        engine: &AudioProcessingEngine,
        source: &ActiveSource,
        chain: &CompiledChain,
        start: u64,
        end: u64,
    ) -> Result<(Vec<f32>, PcmQuality), AppError> {
        engine.render(
            &RenderRequest {
                source,
                stream_index: 0,
                chain,
                range: RANGE,
                start,
                frames: end - start,
                channels: 2,
            },
            &|| false,
        )
    }

    fn slice(samples: &[f32], start: u64, end: u64) -> &[f32] {
        &samples[start as usize * 2..end as usize * 2]
    }

    #[test]
    fn canonical_requests_equal_one_continuous_render_across_boundaries() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        let reference = continuous_reference(&source, &chain);
        let engine = AudioProcessingEngine::new(EngineConfig::default());

        let mut rendered = Vec::new();
        for (start, end) in [(0, 50_000), (50_000, 150_001), (150_001, 384_000)] {
            let (samples, quality) = render(&engine, &source, &chain, start, end).unwrap();
            assert_eq!(quality, PcmQuality::Canonical);
            rendered.extend(samples);
        }
        assert!(
            rendered == reference,
            "stateful chunks diverged from the continuous render"
        );

        // Arbitrary sample-aligned ranges come back from the cache unchanged.
        let (cached, quality) = render(&engine, &source, &chain, 123_457, 200_003).unwrap();
        assert_eq!(quality, PcmQuality::Canonical);
        assert!(cached == slice(&reference, 123_457, 200_003));
    }

    #[test]
    fn consecutive_requests_continue_one_session() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        // Without catch-up, only continuing the origin session can keep later output canonical.
        let engine = AudioProcessingEngine::new(EngineConfig {
            canonical_catchup_frames: 0,
            continuation_window_frames: 48_000,
            ..EngineConfig::default()
        });

        let (_, first) = render(&engine, &source, &chain, 0, 48_000).unwrap();
        let (_, continued) = render(&engine, &source, &chain, 48_000, 96_000).unwrap();
        let (_, after_gap) = render(&engine, &source, &chain, 120_000, 144_000).unwrap();
        assert_eq!(first, PcmQuality::Canonical);
        assert_eq!(continued, PcmQuality::Canonical);
        assert_eq!(after_gap, PcmQuality::Canonical);
    }

    #[test]
    fn distant_requests_are_provisional_previews() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        let reference = continuous_reference(&source, &chain);
        let engine = AudioProcessingEngine::new(EngineConfig {
            canonical_catchup_frames: 48_000,
            continuation_window_frames: 0,
            ..EngineConfig::default()
        });

        let (preview, quality) = render(&engine, &source, &chain, 300_000, 340_000).unwrap();
        assert_eq!(quality, PcmQuality::Provisional);
        // Warm-up keeps the preview close to the canonical signal without claiming equality.
        assert!(max_difference(&preview, slice(&reference, 300_000, 340_000)) < 0.05);

        let stateless = compile_chain(&[gain("g", -6.0)], &[]).unwrap();
        let (_, stateless_quality) =
            render(&engine, &source, &stateless, 300_000, 340_000).unwrap();
        assert_eq!(
            stateless_quality,
            PcmQuality::Provisional,
            "a seeked decode is not proven equal to a continuous decode"
        );
    }

    #[test]
    fn cached_ranges_are_served_without_rendering_and_released_with_the_source() {
        let (fixture, source) = program();
        let chain = stateful_chain();
        // Idle sessions end at the next request, so no process keeps the source open.
        let engine = AudioProcessingEngine::new(EngineConfig {
            session_idle_timeout: Duration::ZERO,
            ..EngineConfig::default()
        });
        let (first, _) = render(&engine, &source, &chain, 0, 96_000).unwrap();
        let (again, _) = render(&engine, &source, &chain, 0, 96_000).unwrap();
        assert!(first == again);

        drop(fixture);
        assert!(!source.path.exists());
        let (cached, quality) = render(&engine, &source, &chain, 1_000, 95_000).unwrap();
        assert!(cached == slice(&first, 1_000, 95_000));
        assert_eq!(quality, PcmQuality::Canonical);
        assert!(render(&engine, &source, &chain, 96_000, 100_000).is_err());

        engine.release_source(source.load_token);
        assert!(render(&engine, &source, &chain, 0, 96_000).is_err());
    }

    #[test]
    fn partial_coverage_reuses_cached_frames_and_renders_the_rest() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        let reference = continuous_reference(&source, &chain);
        let engine = AudioProcessingEngine::new(EngineConfig::default());

        render(&engine, &source, &chain, 0, 48_000).unwrap();
        let (mixed, quality) = render(&engine, &source, &chain, 24_000, 200_000).unwrap();
        assert_eq!(quality, PcmQuality::Canonical);
        assert!(mixed == slice(&reference, 24_000, 200_000));
    }

    #[test]
    fn different_chains_and_orders_never_share_processed_audio() {
        let (_fixture, source) = program();
        let engine = AudioProcessingEngine::new(EngineConfig::default());
        let chain = |filters: Vec<AudioFilter>| compile_chain(&filters, &[]).unwrap();

        let (quiet, _) =
            render(&engine, &source, &chain(vec![gain("g", -12.0)]), 0, 48_000).unwrap();
        let (unity, _) = render(&engine, &source, &chain(vec![gain("g", 0.0)]), 0, 48_000).unwrap();
        assert!(quiet != unity);

        let limited_first = chain(vec![limiter("lim", -6.0), gain("g", 12.0)]);
        let boosted_first = chain(vec![gain("g", 12.0), limiter("lim", -6.0)]);
        let (first, _) = render(&engine, &source, &limited_first, 0, 240_000).unwrap();
        let (second, _) = render(&engine, &source, &boosted_first, 0, 240_000).unwrap();
        assert!(
            first != second,
            "execution order must change the processed signal"
        );
    }

    #[test]
    fn a_new_revision_supersedes_an_in_flight_render() {
        let (_fixture, source) = program();
        let engine = Arc::new(AudioProcessingEngine::new(EngineConfig::default()));
        let (started_sender, started) = mpsc::channel();
        let (resume, resumed) = mpsc::channel::<()>();
        let resumed = Mutex::new(resumed);
        let waited = AtomicBool::new(false);

        let in_flight = {
            let engine = Arc::clone(&engine);
            let source = source.clone();
            thread::spawn(move || {
                let chain = stateful_chain();
                engine.render(
                    &RenderRequest {
                        source: &source,
                        stream_index: 0,
                        chain: &chain,
                        range: RANGE,
                        start: 0,
                        frames: 384_000,
                        channels: 2,
                    },
                    &|| {
                        if !waited.swap(true, Ordering::AcqRel) {
                            started_sender.send(()).unwrap();
                            let _ = resumed.lock().unwrap().recv();
                        }
                        false
                    },
                )
            })
        };

        started.recv().unwrap();
        let newer = compile_chain(&[gain("g", 3.0)], &[]).unwrap();
        let (_, quality) = render(&engine, &source, &newer, 0, 48_000).unwrap();
        assert_eq!(quality, PcmQuality::Canonical);
        resume.send(()).unwrap();

        let error = in_flight.join().unwrap().unwrap_err();
        assert_eq!(
            error.message_id,
            AppErrorMessageId::MediaAudioProcessingChangedBeforeAudioWasReady
        );
    }

    #[test]
    fn cancellation_stops_a_render_and_keeps_the_engine_usable() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        let reference = continuous_reference(&source, &chain);
        let engine = AudioProcessingEngine::new(EngineConfig::default());

        let cancelled = engine
            .render(
                &RenderRequest {
                    source: &source,
                    stream_index: 0,
                    chain: &chain,
                    range: RANGE,
                    start: 0,
                    frames: 384_000,
                    channels: 2,
                },
                &|| true,
            )
            .unwrap_err();
        assert_eq!(
            cancelled.message_id,
            AppErrorMessageId::MediaAudioProcessedAudioRenderWasCancelled
        );

        let (samples, _) = render(&engine, &source, &chain, 0, 384_000).unwrap();
        assert!(samples == reference);
    }

    #[test]
    fn timestamp_gaps_keep_absolute_sample_positions() {
        let fixture = generate_fixture(
            "engine-timestamp-gap",
            "aevalsrc=0.31*sin(2*PI*440*t)+0.22*sin(2*PI*733*t):s=48000:d=8:c=stereo,asetpts=PTS+48000+gte(N\\,144384)*256",
            "nut",
            "pcm_s16le",
        );
        let source = fixture_source(fixture.path(), 8_000_000);
        let chain = compile_chain(&[], &[]).unwrap();
        let reference = continuous_reference(&source, &chain);
        assert_eq!(reference[0], 0.0, "the stream starts one second late");
        let engine = AudioProcessingEngine::new(EngineConfig::default());

        let mut rendered = Vec::new();
        for start in [0, 96_000, 192_000, 288_000] {
            rendered.extend(
                render(&engine, &source, &chain, start, start + 96_000)
                    .unwrap()
                    .0,
            );
        }
        assert!(max_difference(&rendered, &reference) < 1e-6);
    }

    #[test]
    fn rejects_requests_outside_their_range() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        let engine = AudioProcessingEngine::new(EngineConfig::default());
        for (range, start, frames) in [
            (RANGE, 0, 0),
            (RANGE, 380_000, 10_000),
            (
                FrameRange {
                    start: 5,
                    end: 48_000,
                },
                5,
                100,
            ),
            (RANGE, 0, 11 * 48_000),
        ] {
            let error = engine
                .render(
                    &RenderRequest {
                        source: &source,
                        stream_index: 0,
                        chain: &chain,
                        range,
                        start,
                        frames,
                        channels: 2,
                    },
                    &|| false,
                )
                .unwrap_err();
            assert_eq!(error.code, "invalid_request");
        }
    }
}
