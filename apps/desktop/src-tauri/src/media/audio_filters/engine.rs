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
    process::{ChildTerminator, media_debug},
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

/// What a render is for. It decides which earlier revisions a request supersedes and how long its
/// samples are kept.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RenderPurpose {
    /// Playback of the committed chain.
    Playback,
    /// Playback of a draft chain being auditioned before it is committed. Its samples and
    /// sessions are temporary until the chain is used as committed audio or the preview ends.
    PlaybackPreview,
    /// A waveform pass over the committed chain.
    Waveform,
}

impl RenderPurpose {
    fn lane(self) -> RenderLane {
        match self {
            Self::Playback | Self::PlaybackPreview => RenderLane::Playback,
            Self::Waveform => RenderLane::Waveform,
        }
    }

    fn is_preview(self) -> bool {
        self == Self::PlaybackPreview
    }
}

/// Consumers that render a stream independently. Playback auditions draft chains while a waveform
/// pass of the committed chain runs, so neither may stop the other.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum RenderLane {
    Playback,
    Waveform,
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
    pub purpose: RenderPurpose,
    /// Renders processing that will replace the scope's audible processing. It supersedes only
    /// an earlier replacement, so the audible processing keeps rendering until the switch.
    pub replacement: bool,
}

/// The demand-driven renderer for processed track audio.
///
/// It serves requested frame ranges from the disk cache and renders only the missing parts,
/// through persistent FFmpeg sessions that keep stateful filters continuous. Each consumer of a
/// source stream is one scope with an audible revision and, while processing changes, one
/// replacement revision. A request for a different chain supersedes the scope's previous
/// revision of its kind, terminating its sessions and rejecting its results, so stale revisions
/// never reach the cache or the caller. Requesting the replacement as audible processing completes
/// the switch. Scopes share cached samples but never sessions or revisions.
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
    lane: RenderLane,
}

#[derive(Default)]
struct ScopeState {
    /// The processing being played, or rendered for a waveform.
    audible: Option<Revision>,
    /// Processing rendering to replace the audible processing.
    replacement: Option<Revision>,
    next_generation: u64,
}

struct Revision {
    key: RenderKey,
    generation: u64,
    /// Whether the revision auditions a draft chain.
    preview: bool,
}

impl ScopeState {
    fn revisions(&self) -> impl Iterator<Item = &Revision> {
        self.audible.iter().chain(&self.replacement)
    }

    fn revisions_mut(&mut self) -> impl Iterator<Item = &mut Revision> {
        self.audible.iter_mut().chain(&mut self.replacement)
    }

    fn live(&self, generation: u64) -> Option<&Revision> {
        self.revisions()
            .find(|revision| revision.generation == generation)
    }

    fn revision(&mut self, key: &RenderKey, preview: bool) -> Revision {
        self.next_generation += 1;
        Revision {
            key: key.clone(),
            generation: self.next_generation,
            preview,
        }
    }

    /// Registers a request's key and returns the generation of the revision it belongs to.
    fn begin(&mut self, key: &RenderKey, preview: bool, replacement: bool) -> u64 {
        let existing = self.revisions_mut().find(|revision| revision.key == *key);
        if let Some(existing) = existing {
            existing.preview &= preview;
            let generation = existing.generation;
            // Audible use of the replacement means playback switched to it.
            if !replacement
                && self
                    .replacement
                    .as_ref()
                    .is_some_and(|revision| revision.generation == generation)
            {
                self.audible = self.replacement.take();
            }
            return generation;
        }
        let revision = self.revision(key, preview);
        let generation = revision.generation;
        if replacement {
            self.replacement = Some(revision);
        } else {
            // New audible processing, such as a start with other processing, replaces both.
            self.audible = Some(revision);
            self.replacement = None;
        }
        generation
    }
}

/// Everything a request needs to render and commit gaps: what to render and which revision of
/// its scope it belongs to.
struct RenderTarget<'a> {
    canonical_only: bool,
    /// Whether rendered segments are committed to the cache or only returned to the caller.
    retain: bool,
    request: &'a RenderRequest<'a>,
    key: RenderKey,
    scope: RenderScope,
    generation: u64,
}

struct SessionSlot {
    key: RenderKey,
    scope: RenderScope,
    /// Started for a draft chain that has not been requested as committed audio since.
    preview: bool,
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
        self.render_with_quality(request, is_cancelled, false)
    }

    /// Renders continuous, authoritative samples, replacing provisional seek-cache coverage.
    ///
    /// A pass over a range larger than half the cache reuses cached segments but does not commit
    /// the frames it renders: retaining them would evict everything else, including the segments
    /// playback is using, without leaving the range cached.
    pub fn render_canonical(
        &self,
        request: &RenderRequest<'_>,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<Vec<f32>, AppError> {
        self.render_with_quality(request, is_cancelled, true)
            .map(|(samples, _)| samples)
    }

    fn render_with_quality(
        &self,
        request: &RenderRequest<'_>,
        is_cancelled: &dyn Fn() -> bool,
        canonical_only: bool,
    ) -> Result<(Vec<f32>, PcmQuality), AppError> {
        validate_request(request)?;
        if is_cancelled() || request.source.cancellation.load(Ordering::Acquire) {
            return Err(AppError::cancelled(
                AppErrorMessageId::MediaAudioProcessedAudioRenderWasCancelled,
            ));
        }
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
            lane: request.purpose.lane(),
        };
        let generation = self.begin(
            scope,
            &key,
            request.purpose.is_preview(),
            request.replacement,
        )?;
        let range_bytes = (request.range.end - request.range.start)
            * u64::from(request.channels)
            * size_of::<f32>() as u64;
        let target = RenderTarget {
            canonical_only,
            retain: !canonical_only || range_bytes <= self.config.cache_limit_bytes / 2,
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
            if is_cancelled() || request.source.cancellation.load(Ordering::Acquire) {
                return Err(AppError::cancelled(
                    AppErrorMessageId::MediaAudioProcessedAudioRenderWasCancelled,
                ));
            }
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
                    if !(canonical_only && cached_quality == PcmQuality::Provisional)
                        && read_segment_frames(
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

    /// Ends the playback preview of one stream. The sessions and cached audio of auditioned draft
    /// chains are released, and a request still rendering one fails as superseded. `keep` is the
    /// chain playback continues with, for example the draft that was just applied: it becomes
    /// committed audio instead of being released.
    pub fn release_preview(&self, load_token: u64, stream_index: u32, keep: Option<&RenderKey>) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        if let Some(keep) = keep {
            promote(&mut state, keep);
        }
        state.sessions.retain(|slot| {
            let released = slot.preview
                && slot.key.load_token == load_token
                && slot.key.stream_index == stream_index;
            if released {
                slot.terminate();
            }
            !released
        });
        state.cache.remove_preview(load_token, stream_index);
        let playback = RenderScope {
            load_token,
            stream_index,
            lane: RenderLane::Playback,
        };
        if let Some(current) = state.scopes.get_mut(&playback) {
            current.audible.take_if(|revision| revision.preview);
            current.replacement.take_if(|revision| revision.preview);
        }
    }

    /// Registers the request's key in its scope. A different key supersedes the scope's previous
    /// revision of the same kind, audible or replacement, and stops its sessions; other scopes are
    /// unaffected. Committed use of a key promotes its preview sessions and audio.
    fn begin(
        &self,
        scope: RenderScope,
        key: &RenderKey,
        preview: bool,
        replacement: bool,
    ) -> Result<u64, AppError> {
        let mut state = self.lock()?;
        let idle_timeout = self.config.session_idle_timeout;
        state.sessions.retain(|slot| {
            let keep = slot.last_used.elapsed() < idle_timeout;
            if !keep {
                slot.terminate();
            }
            keep
        });
        if !preview {
            promote(&mut state, key);
        }
        let current = state.scopes.entry(scope).or_default();
        let generation = current.begin(key, preview, replacement);
        let live = current
            .revisions()
            .map(|revision| revision.key.clone())
            .collect::<Vec<_>>();
        state.sessions.retain(|slot| {
            let superseded = slot.scope == scope && !live.contains(&slot.key);
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
            Some(current) if current.live(generation).is_some() => Ok(()),
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
            retain,
            request,
            key,
            scope,
            generation,
            ..
        } = target;
        let (scope, generation) = (*scope, *generation);
        let mut slot = self.session_for(target, start, false)?;
        let mut session = slot.0.lock().map_err(|_| session_unavailable())?;
        if session.cursor > start {
            // Another request advanced the session past this gap without caching it.
            drop(session);
            slot = self.session_for(target, start, true)?;
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
                read.map_err(|error| self.render_error(error, target, session_handle))?;
                continue;
            }
            // Segments end at the gap start and end so requested frames are never split.
            let boundary = if position < start { start } else { end };
            let frames = (boundary - position).min(MAX_SEGMENT_FRAMES);
            let read = session.read_frames(frames, cancelled);
            cursor.store(session.cursor, Ordering::Release);
            let samples = read.map_err(|error| self.render_error(error, target, session_handle))?;
            if *retain {
                self.store_segment(target, position, frames, session.quality, &samples)?;
            } else {
                self.ensure_current(scope, generation)?;
            }

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
    /// scope and key that is shortly behind it, or a new one. A new session renders from the range
    /// origin when that is close enough, which makes it canonical; otherwise it seeks with the
    /// chain's warm-up and its output stays provisional.
    fn session_for(
        &self,
        target: &RenderTarget<'_>,
        start: u64,
        force_new: bool,
    ) -> Result<(Arc<Mutex<RenderSession>>, Arc<AtomicU64>), AppError> {
        let RenderTarget {
            canonical_only,
            request,
            key,
            scope,
            ..
        } = target;
        let canonical_only = *canonical_only;
        let mut state = self.lock()?;
        if !force_new
            && let Some(slot) = state.sessions.iter_mut().find(|slot| {
                let cursor = slot.cursor.load(Ordering::Acquire);
                slot.scope == *scope
                    && slot.key == *key
                    && (!canonical_only || slot.committed_from == key.range.start)
                    && slot.committed_from <= start
                    && cursor <= start
                    && (canonical_only || start - cursor <= self.config.continuation_window_frames)
            })
        {
            slot.last_used = Instant::now();
            return Ok((Arc::clone(&slot.session), Arc::clone(&slot.cursor)));
        }
        // Checked under the engine lock: a source cancelled and released while this request was
        // in flight must not start a process that reopens it.
        if request.source.cancellation.load(Ordering::Acquire) {
            return Err(AppError::cancelled(
                AppErrorMessageId::MediaAudioProcessedAudioRenderWasCancelled,
            ));
        }

        let origin = key.range.start;
        let (seek_frame, committed_from) =
            if canonical_only || start - origin <= self.config.canonical_catchup_frames {
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
        .map_err(|error| start_error(request.purpose, &error))?;

        if state.sessions.len() >= self.config.max_sessions
            && let Some(evicted) = evictable_session(&state)
        {
            state.sessions.remove(evicted).terminate();
        }
        let cursor = Arc::new(AtomicU64::new(seek_frame));
        let preview = state.scopes.get(scope).is_some_and(|current| {
            current
                .revisions()
                .any(|revision| revision.key == *key && revision.preview)
        });
        let slot = SessionSlot {
            key: key.clone(),
            scope: *scope,
            preview,
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
        let Some(preview) = state
            .scopes
            .get(&target.scope)
            .and_then(|current| current.live(target.generation))
            .map(|revision| revision.preview)
        else {
            let _ = std::fs::remove_file(&path);
            return Err(superseded());
        };
        state
            .cache
            .commit(&target.key, start, frames, quality, path, preview)
            .map_err(cache_error)
    }

    /// Classifies a session failure. A cancelled read leaves the session consistent and reusable;
    /// any other failure discards it so the next request starts a new one.
    fn render_error(
        &self,
        error: io::Error,
        target: &RenderTarget<'_>,
        session: &Arc<Mutex<RenderSession>>,
    ) -> AppError {
        if self
            .ensure_current(target.scope, target.generation)
            .is_err()
        {
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
        let playback_message = match error.kind() {
            io::ErrorKind::TimedOut => {
                AppErrorMessageId::MediaAudioPlaybackAudioDecodingTookTooLong
            }
            _ => AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
        };
        render_failure(target.request.purpose, playback_message, &error)
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

/// The session to stop when the limit is reached: never one a request is rendering with, and one
/// rendering audible processing only after every other kind, least recently used first. When
/// every session is in use, none is stopped and the limit is exceeded until one is idle.
fn evictable_session(state: &EngineState) -> Option<usize> {
    state
        .sessions
        .iter()
        .enumerate()
        .filter(|(_, slot)| Arc::strong_count(&slot.session) == 1)
        .min_by_key(|(_, slot)| {
            let audible = state
                .scopes
                .get(&slot.scope)
                .and_then(|current| current.audible.as_ref())
                .is_some_and(|revision| revision.key == slot.key);
            (audible, slot.last_used)
        })
        .map(|(index, _)| index)
}

/// Keeps a key's sessions and audio as committed audio.
fn promote(state: &mut EngineState, key: &RenderKey) {
    state.cache.promote(key);
    for slot in state.sessions.iter_mut().filter(|slot| slot.key == *key) {
        slot.preview = false;
    }
    for revision in state
        .scopes
        .values_mut()
        .flat_map(ScopeState::revisions_mut)
        .filter(|revision| revision.key == *key)
    {
        revision.preview = false;
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

fn start_error(purpose: RenderPurpose, error: &io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::NotFound => AppError::preview_failed(
            AppErrorMessageId::MediaAudioFfmpegIsRequiredForPlayback,
            None::<String>,
        ),
        _ => render_failure(
            purpose,
            AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio,
            error,
        ),
    }
}

/// The failure of a render, reported as the operation that asked for it: a waveform pass never
/// surfaces a playback error. The diagnostics name the operation and carry the underlying error,
/// including how the FFmpeg process ended.
fn render_failure(
    purpose: RenderPurpose,
    playback_message: AppErrorMessageId,
    error: &io::Error,
) -> AppError {
    let diagnostics = format!("{purpose:?} render failed: {error}");
    media_debug(&diagnostics);
    match purpose {
        RenderPurpose::Waveform => AppError::waveform_failed(
            AppErrorMessageId::MediaWaveformFfmpegCouldNotGenerateTheAudioWaveform,
            Some(diagnostics),
        ),
        RenderPurpose::Playback | RenderPurpose::PlaybackPreview => {
            AppError::preview_failed(playback_message, Some(diagnostics))
        }
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

    use super::{AudioProcessingEngine, EngineConfig, RenderPurpose, RenderRequest};
    use crate::{
        error::{AppError, AppErrorMessageId},
        media::audio_filters::{
            compiler::{CompiledChain, compile_chain},
            model::{AudioFilter, AudioLoudnessAnalysis, FilterMeasurement, fixtures::*},
            pcm_cache::{CoveragePart, FrameRange, PcmQuality, RenderKey},
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
        render_for(engine, source, chain, start, end, RenderPurpose::Playback)
    }

    fn render_for(
        engine: &AudioProcessingEngine,
        source: &ActiveSource,
        chain: &CompiledChain,
        start: u64,
        end: u64,
        purpose: RenderPurpose,
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
                purpose,
                replacement: false,
            },
            &|| false,
        )
    }

    fn key_of(source: &ActiveSource, chain: &CompiledChain) -> RenderKey {
        RenderKey {
            load_token: source.load_token,
            stream_index: 0,
            graph: chain.canonical_graph(),
            range: RANGE,
            channels: 2,
        }
    }

    fn cached_frames(engine: &AudioProcessingEngine, key: &RenderKey) -> u64 {
        engine
            .lock()
            .unwrap()
            .cache
            .plan(key, RANGE.start, RANGE.end)
            .into_iter()
            .map(|part| match part {
                CoveragePart::Cached { start, end, .. } => end - start,
                CoveragePart::Missing { .. } => 0,
            })
            .sum()
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
    fn canonical_consumer_replaces_provisional_seek_samples() {
        let (_file, source) = program();
        let chain = stateful_chain();
        let engine = AudioProcessingEngine::new(EngineConfig {
            canonical_catchup_frames: 0,
            continuation_window_frames: 0,
            ..EngineConfig::default()
        });
        let (_, quality) = render(&engine, &source, &chain, 300_000, 340_000).unwrap();
        assert_eq!(quality, PcmQuality::Provisional);
        let canonical = engine
            .render_canonical(
                &RenderRequest {
                    source: &source,
                    stream_index: 0,
                    chain: &chain,
                    range: RANGE,
                    start: 300_000,
                    frames: 40_000,
                    channels: 2,
                    purpose: RenderPurpose::Waveform,
                    replacement: false,
                },
                &|| false,
            )
            .unwrap();
        let reference = continuous_reference(&source, &chain);
        assert_eq!(canonical, slice(&reference, 300_000, 340_000));
        let (cached, quality) = render(&engine, &source, &chain, 300_000, 340_000).unwrap();
        assert_eq!(quality, PcmQuality::Canonical);
        assert_eq!(cached, canonical);
    }

    #[test]
    fn canonical_passes_over_large_ranges_stream_without_evicting_playback_segments() {
        let (_file, source) = program();
        let chain = stateful_chain();
        let reference = continuous_reference(&source, &chain);
        // The 8 s stereo range is 3 MB of float PCM, more than half of this cache.
        let engine = AudioProcessingEngine::new(EngineConfig {
            cache_limit_bytes: 4 * 1024 * 1024,
            ..EngineConfig::default()
        });
        let (played, _) = render(&engine, &source, &chain, 96_000, 144_000).unwrap();

        let mut canonical = Vec::new();
        for start in (RANGE.start..RANGE.end).step_by(96_000) {
            canonical.extend(
                engine
                    .render_canonical(
                        &RenderRequest {
                            source: &source,
                            stream_index: 0,
                            chain: &chain,
                            range: RANGE,
                            start,
                            frames: 96_000,
                            channels: 2,
                            purpose: RenderPurpose::Waveform,
                            replacement: false,
                        },
                        &|| false,
                    )
                    .unwrap(),
            );
        }
        assert!(canonical == reference);
        assert!(played == slice(&reference, 96_000, 144_000));

        let key = RenderKey {
            load_token: source.load_token,
            stream_index: 0,
            graph: chain.canonical_graph(),
            range: RANGE,
            channels: 2,
        };
        // Playback caught up from the origin, so only its [0, 144 000) render is cached.
        let cached_frames: u64 = engine
            .lock()
            .unwrap()
            .cache
            .plan(&key, RANGE.start, RANGE.end)
            .into_iter()
            .map(|part| match part {
                CoveragePart::Cached { start, end, .. } => end - start,
                CoveragePart::Missing { .. } => 0,
            })
            .sum();
        assert_eq!(cached_frames, 144_000);
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
                        purpose: RenderPurpose::Playback,
                        replacement: false,
                    },
                    &|| {
                        // Preflight cancellation can run before a revision is registered. Pause
                        // only after a session exists to exercise an actually in-flight render.
                        if !engine.lock().unwrap().sessions.is_empty()
                            && !waited.swap(true, Ordering::AcqRel)
                        {
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

    type RenderResult = Result<(Vec<f32>, PcmQuality), AppError>;

    /// Starts a playback render on another thread and holds it once its session renders.
    fn paused_render(
        engine: &Arc<AudioProcessingEngine>,
        source: &ActiveSource,
        filters: Vec<AudioFilter>,
        replacement: bool,
    ) -> (thread::JoinHandle<RenderResult>, mpsc::Sender<()>) {
        let (started_sender, started) = mpsc::channel();
        let (resume, resumed) = mpsc::channel::<()>();
        let in_flight = {
            let engine = Arc::clone(engine);
            let source = source.clone();
            thread::spawn(move || {
                let chain = compile_chain(&filters, &[]).unwrap();
                let graph = chain.canonical_graph();
                let waited = AtomicBool::new(false);
                engine.render(
                    &RenderRequest {
                        source: &source,
                        stream_index: 0,
                        chain: &chain,
                        range: RANGE,
                        start: 0,
                        frames: 384_000,
                        channels: 2,
                        purpose: RenderPurpose::Playback,
                        replacement,
                    },
                    &|| {
                        if engine
                            .lock()
                            .unwrap()
                            .sessions
                            .iter()
                            .any(|slot| slot.key.graph == graph)
                            && !waited.swap(true, Ordering::AcqRel)
                        {
                            started_sender.send(()).unwrap();
                            let _ = resumed.recv();
                        }
                        false
                    },
                )
            })
        };
        started.recv().unwrap();
        (in_flight, resume)
    }

    fn render_replacement(
        engine: &AudioProcessingEngine,
        source: &ActiveSource,
        chain: &CompiledChain,
        start: u64,
        end: u64,
    ) -> RenderResult {
        engine.render(
            &RenderRequest {
                source,
                stream_index: 0,
                chain,
                range: RANGE,
                start,
                frames: end - start,
                channels: 2,
                purpose: RenderPurpose::Playback,
                replacement: true,
            },
            &|| false,
        )
    }

    #[test]
    fn audible_processing_keeps_rendering_while_its_replacement_renders() {
        let (_fixture, source) = program();
        let engine = Arc::new(AudioProcessingEngine::new(EngineConfig::default()));
        let audible = vec![gain("g", -3.0)];

        let (in_flight, resume) = paused_render(&engine, &source, audible.clone(), false);
        let replacement = compile_chain(&[gain("g", 6.0)], &[]).unwrap();
        render_replacement(&engine, &source, &replacement, 96_000, 144_000).unwrap();
        resume.send(()).unwrap();
        assert!(
            in_flight.join().unwrap().is_ok(),
            "a replacement must not stop the audible processing"
        );

        // A newer replacement supersedes only the earlier replacement.
        let (stale, resume) = paused_render(&engine, &source, vec![gain("g", 9.0)], true);
        let newest = compile_chain(&[gain("g", 12.0)], &[]).unwrap();
        render_replacement(&engine, &source, &newest, 96_000, 144_000).unwrap();
        resume.send(()).unwrap();
        assert_eq!(
            stale.join().unwrap().unwrap_err().message_id,
            AppErrorMessageId::MediaAudioProcessingChangedBeforeAudioWasReady
        );
        let audible = compile_chain(&audible, &[]).unwrap();
        render(&engine, &source, &audible, 144_000, 192_000).unwrap();

        // Playing the replacement completes the switch and releases the previous processing.
        render(&engine, &source, &newest, 192_000, 240_000).unwrap();
        assert!(
            engine
                .lock()
                .unwrap()
                .sessions
                .iter()
                .all(|slot| slot.key.graph == newest.canonical_graph())
        );
    }

    #[test]
    fn the_session_limit_never_stops_a_session_a_request_is_rendering_with() {
        let (_fixture, source) = program();
        let engine = Arc::new(AudioProcessingEngine::new(EngineConfig {
            max_sessions: 2,
            ..EngineConfig::default()
        }));
        let audible = vec![gain("g", -3.0)];
        let (in_flight, resume) = paused_render(&engine, &source, audible, false);

        let waveform_chain = compile_chain(&[gain("g", 1.0)], &[]).unwrap();
        engine
            .render_canonical(
                &RenderRequest {
                    source: &source,
                    stream_index: 0,
                    chain: &waveform_chain,
                    range: RANGE,
                    start: 0,
                    frames: 48_000,
                    channels: 2,
                    purpose: RenderPurpose::Waveform,
                    replacement: false,
                },
                &|| false,
            )
            .unwrap();
        // A third session exceeds the limit; the idle waveform session goes, not the busy one.
        let replacement = compile_chain(&[gain("g", 6.0)], &[]).unwrap();
        render_replacement(&engine, &source, &replacement, 96_000, 144_000).unwrap();
        let sessions = engine.lock().unwrap().sessions.len();
        resume.send(()).unwrap();

        assert!(in_flight.join().unwrap().is_ok());
        assert_eq!(sessions, 2);
    }

    #[test]
    fn playback_of_another_chain_does_not_supersede_a_waveform_pass() {
        let (_fixture, source) = program();
        let chain = stateful_chain();
        let reference = continuous_reference(&source, &chain);
        let engine = Arc::new(AudioProcessingEngine::new(EngineConfig::default()));
        let (started_sender, started) = mpsc::channel();
        let (resume, resumed) = mpsc::channel::<()>();
        let resumed = Mutex::new(resumed);
        let waited = AtomicBool::new(false);

        let waveform = {
            let engine = Arc::clone(&engine);
            let source = source.clone();
            thread::spawn(move || {
                let chain = stateful_chain();
                engine.render_canonical(
                    &RenderRequest {
                        source: &source,
                        stream_index: 0,
                        chain: &chain,
                        range: RANGE,
                        start: 0,
                        frames: 384_000,
                        channels: 2,
                        purpose: RenderPurpose::Waveform,
                        replacement: false,
                    },
                    &|| {
                        if !engine.lock().unwrap().sessions.is_empty()
                            && !waited.swap(true, Ordering::AcqRel)
                        {
                            started_sender.send(()).unwrap();
                            let _ = resumed.lock().unwrap().recv();
                        }
                        false
                    },
                )
            })
        };

        started.recv().unwrap();
        let auditioned = compile_chain(&[gain("g", 3.0)], &[]).unwrap();
        render(&engine, &source, &auditioned, 0, 48_000).unwrap();
        resume.send(()).unwrap();

        let samples = waveform.join().unwrap().unwrap();
        assert!(samples == reference);
    }

    /// The reported chain: dynamic loudness normalization runs between stateful filters.
    fn dynamic_normalization_chain() -> CompiledChain {
        compile_chain(
            &[
                noise_reduction("nr"),
                gain("g", 10.0),
                limiter("lim", -1.0),
                normalization("norm", -16.0),
                high_pass("hp", 80.0),
            ],
            &[FilterMeasurement {
                filter_id: "norm".to_owned(),
                analysis: AudioLoudnessAnalysis {
                    input_lra: Some(6.8),
                    input_threshold: Some(-33.29),
                    integrated_lufs: Some(-22.04),
                    true_peak_db: Some(-1.0),
                },
            }],
        )
        .unwrap()
    }

    #[test]
    fn a_waveform_pass_renders_a_dynamic_normalization_chain_to_the_range_end_beside_playback() {
        // A compressed source of an uneven length whose range ends mid-block, like imported video.
        let material = PROGRAM_MATERIAL
            .replace(":s=48000:d=8:", ":s=44100:d=7.123:")
            .replace("*if(lt(t,3),0.2,if(lt(t,5),1,0.4))", "*0.1");
        let fixture = generate_fixture("engine-compressed", &material, "m4a", "aac");
        let source = fixture_source(fixture.path(), 7_123_000);
        let range = FrameRange {
            start: 0,
            end: 341_904,
        };
        let chain = dynamic_normalization_chain();
        let reference = decode_f32_stereo(&[
            OsString::from("-i"),
            source.path.as_os_str().to_owned(),
            OsString::from("-filter_complex"),
            OsString::from(format!(
                "[0:0]{},apad=whole_len={},atrim=end_sample={}[out]",
                chain.canonical_graph(),
                range.end,
                range.end
            )),
            OsString::from("-map"),
            OsString::from("[out]"),
        ]);
        assert_eq!(reference.len() as u64, range.end * 2);
        let engine = Arc::new(AudioProcessingEngine::new(EngineConfig::default()));
        let request = |chain, start, frames, purpose| RenderRequest {
            source: &source,
            stream_index: 0,
            chain,
            range,
            start,
            frames,
            channels: 2,
            purpose,
            replacement: false,
        };

        let draft = compile_chain(&[gain("g", 4.0)], &[]).unwrap();
        let (waveform, playback_errors) = thread::scope(|scope| {
            // Playback seeks around, auditions a draft, and plays the end of the source meanwhile.
            let playback = scope.spawn(|| {
                let mut errors = Vec::new();
                for round in 0..3 {
                    for (chain, start, frames, purpose) in [
                        (&chain, 100_000, 96_000, RenderPurpose::Playback),
                        (&draft, 120_000, 48_000, RenderPurpose::PlaybackPreview),
                        (&chain, 245_904, 96_000, RenderPurpose::Playback),
                    ] {
                        let start = start + round * 1_000;
                        let frames = frames.min(range.end - start);
                        if let Err(error) =
                            engine.render(&request(chain, start, frames, purpose), &|| false)
                        {
                            errors.push(error);
                        }
                    }
                }
                errors
            });
            let mut samples = Vec::new();
            for start in (range.start..range.end).step_by(48_000) {
                let frames = (range.end - start).min(48_000);
                samples.extend(
                    engine
                        .render_canonical(
                            &request(&chain, start, frames, RenderPurpose::Waveform),
                            &|| false,
                        )
                        .unwrap(),
                );
            }
            (samples, playback.join().unwrap())
        });
        assert!(playback_errors.is_empty(), "{playback_errors:?}");
        assert!(
            waveform == reference,
            "the waveform pass diverged from one continuous render"
        );
    }

    #[test]
    fn a_failed_render_reports_its_operation_and_how_ffmpeg_ended() {
        let (fixture, source) = program();
        let chain = stateful_chain();
        let engine = AudioProcessingEngine::new(EngineConfig::default());
        let missing = source
            .path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        drop(fixture);

        let request = |purpose| RenderRequest {
            source: &source,
            stream_index: 0,
            chain: &chain,
            range: RANGE,
            start: 0,
            frames: 48_000,
            channels: 2,
            purpose,
            replacement: false,
        };
        let playback = engine
            .render(&request(RenderPurpose::Playback), &|| false)
            .unwrap_err();
        assert_eq!(playback.code, "preview_failed");
        assert_eq!(
            playback.message_id,
            AppErrorMessageId::MediaAudioFfmpegCouldNotDecodePlaybackAudio
        );

        // A waveform pass is not a playback chunk, whatever else is playing.
        let waveform = engine
            .render_canonical(&request(RenderPurpose::Waveform), &|| false)
            .unwrap_err();
        assert_eq!(waveform.code, "waveform_failed");
        assert_eq!(
            waveform.message_id,
            AppErrorMessageId::MediaWaveformFfmpegCouldNotGenerateTheAudioWaveform
        );
        let diagnostics = waveform.diagnostics.unwrap();
        for expected in [
            "Waveform render failed",
            "frame 0 of 384000",
            "stream 0",
            &missing,
        ] {
            assert!(diagnostics.contains(expected), "{expected}: {diagnostics}");
        }
    }

    #[test]
    fn ending_a_preview_releases_draft_audio_but_keeps_committed_and_applied_chains() {
        let (_fixture, source) = program();
        let engine = AudioProcessingEngine::new(EngineConfig::default());
        let chain = |gain_db: f64| compile_chain(&[gain("g", gain_db)], &[]).unwrap();
        let (committed, abandoned, applied) = (chain(-3.0), chain(3.0), chain(6.0));

        render(&engine, &source, &committed, 0, 48_000).unwrap();
        render_for(
            &engine,
            &source,
            &abandoned,
            0,
            48_000,
            RenderPurpose::PlaybackPreview,
        )
        .unwrap();
        // Auditioning the committed chain does not make its audio temporary.
        render_for(
            &engine,
            &source,
            &committed,
            0,
            96_000,
            RenderPurpose::PlaybackPreview,
        )
        .unwrap();
        engine.release_preview(source.load_token, 0, None);
        assert_eq!(cached_frames(&engine, &key_of(&source, &abandoned)), 0);
        assert_eq!(cached_frames(&engine, &key_of(&source, &committed)), 96_000);
        assert!(
            engine
                .lock()
                .unwrap()
                .sessions
                .iter()
                .all(|slot| !slot.preview)
        );

        render_for(
            &engine,
            &source,
            &applied,
            0,
            48_000,
            RenderPurpose::PlaybackPreview,
        )
        .unwrap();
        engine.release_preview(source.load_token, 0, Some(&key_of(&source, &applied)));
        assert_eq!(cached_frames(&engine, &key_of(&source, &applied)), 48_000);
        let state = engine.lock().unwrap();
        assert_eq!(
            state.sessions.len(),
            1,
            "playback continues the applied chain"
        );
        assert!(state.sessions[0].key == key_of(&source, &applied) && !state.sessions[0].preview);
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
                    purpose: RenderPurpose::Playback,
                    replacement: false,
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
                        purpose: RenderPurpose::Playback,
                        replacement: false,
                    },
                    &|| false,
                )
                .unwrap_err();
            assert_eq!(error.code, "invalid_request");
        }
    }
}
