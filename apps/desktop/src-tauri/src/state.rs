use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};

use crate::media::probe::MediaInfo;
use crate::{domain::source::ValidatedSource, error::AppError};

const STALE_ARTIFACT_AGE: std::time::Duration = std::time::Duration::from_secs(60 * 60);

pub fn cleanup_stale_media_artifacts() {
    let Ok(entries) = fs::read_dir(std::env::temp_dir()) else {
        return;
    };
    let cutoff = std::time::SystemTime::now()
        .checked_sub(STALE_ARTIFACT_AGE)
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let is_clipkit_artifact = name.starts_with("clipkit-preview-")
            || name.starts_with("clipkit-audio-preview-")
            || name.starts_with("clipkit-waveform-");
        if !is_clipkit_artifact || !entry.file_type().is_ok_and(|file_type| file_type.is_dir()) {
            continue;
        }
        let is_stale = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .is_ok_and(|modified| modified < cutoff);
        if is_stale {
            let _ = fs::remove_dir_all(path);
        }
    }
}

#[derive(Clone, Debug)]
pub struct ActiveSource {
    pub source_id: String,
    pub path: PathBuf,
    pub cancellation: Arc<AtomicBool>,
    pub media: Option<MediaInfo>,
    pub preview_streams: Option<PreviewStreamSelection>,
    pub audio_stream_indexes: Vec<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PreviewStreamSelection {
    pub video_stream_index: u32,
    pub audio_stream_index: Option<u32>,
}

#[derive(Debug)]
pub struct TemporaryMediaArtifact {
    directory: PathBuf,
    path: PathBuf,
}

impl TemporaryMediaArtifact {
    pub fn new(directory: PathBuf, path: PathBuf) -> Result<Self, AppError> {
        if path.parent() != Some(directory.as_path()) {
            return Err(AppError::internal(
                "The preview artifact is outside its session directory.",
            ));
        }
        Ok(Self { directory, path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TemporaryMediaArtifact {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
        let _ = fs::remove_dir(&self.directory);
    }
}

pub type PreviewArtifact = TemporaryMediaArtifact;
pub type AudioPreviewArtifact = TemporaryMediaArtifact;
pub type WaveformArtifact = TemporaryMediaArtifact;

#[derive(Clone, Debug)]
pub struct WaveformSource {
    pub source: ActiveSource,
    pub cancellation: Arc<AtomicBool>,
}

#[derive(Debug)]
struct WaveformRecord {
    width: u32,
    artifact: WaveformArtifact,
}

#[derive(Debug)]
struct WaveformJobRecord {
    job_id: String,
    cancellation: Arc<AtomicBool>,
}

#[derive(Debug)]
struct ActiveSourceRecord {
    source_id: String,
    path: PathBuf,
    cancellation: Arc<AtomicBool>,
    media: Option<MediaInfo>,
    preview_streams: Option<PreviewStreamSelection>,
    preview: Option<PreviewArtifact>,
    audio_previews: HashMap<u32, AudioPreviewArtifact>,
    audio_stream_indexes: Vec<u32>,
    waveform_job: Option<WaveformJobRecord>,
    waveforms: HashMap<u32, WaveformRecord>,
}

#[derive(Debug, Default)]
struct SessionState {
    active_source: Option<ActiveSourceRecord>,
    latest_generation: u64,
}

#[derive(Debug, Default)]
pub struct AppState {
    next_generation: AtomicU64,
    next_output: AtomicU64,
    next_operation: AtomicU64,
    session: Mutex<SessionState>,
    outputs: Mutex<HashMap<String, PathBuf>>,
    operations: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AppState {
    pub fn begin_source_replacement(&self) -> Result<u64, AppError> {
        let generation = self.next_generation.fetch_add(1, Ordering::Relaxed) + 1;
        let mut session = self.lock_session()?;
        session.latest_generation = generation;
        let previous_source = session.active_source.take();
        drop(session);

        if let Some(previous_source) = previous_source {
            previous_source.cancellation.store(true, Ordering::Release);
        }
        if let Ok(operations) = self.operations.lock() {
            for cancellation in operations.values() {
                cancellation.store(true, Ordering::Release);
            }
        }
        self.outputs
            .lock()
            .map_err(|_| AppError::internal("The in-memory output registry is unavailable."))?
            .clear();
        Ok(generation)
    }

    pub fn register_output(&self, path: PathBuf) -> Result<String, AppError> {
        let id = format!(
            "output-{}",
            self.next_output.fetch_add(1, Ordering::Relaxed) + 1
        );
        self.outputs
            .lock()
            .map_err(|_| AppError::internal("The in-memory output registry is unavailable."))?
            .insert(id.clone(), path);
        Ok(id)
    }

    pub fn resolve_output(&self, output_id: &str) -> Result<PathBuf, AppError> {
        self.outputs
            .lock()
            .map_err(|_| AppError::internal("The in-memory output registry is unavailable."))?
            .get(output_id)
            .cloned()
            .ok_or_else(|| AppError::invalid_request("The output location is no longer available."))
    }

    pub fn begin_operation(&self) -> Result<(String, Arc<AtomicBool>), AppError> {
        let id = format!(
            "operation-{}",
            self.next_operation.fetch_add(1, Ordering::Relaxed) + 1
        );
        let cancellation = Arc::new(AtomicBool::new(false));
        self.operations
            .lock()
            .map_err(|_| AppError::internal("The in-memory operation registry is unavailable."))?
            .insert(id.clone(), Arc::clone(&cancellation));
        Ok((id, cancellation))
    }

    pub fn cancel_operation(&self, operation_id: &str) -> Result<(), AppError> {
        let operations = self
            .operations
            .lock()
            .map_err(|_| AppError::internal("The in-memory operation registry is unavailable."))?;
        operations
            .get(operation_id)
            .ok_or_else(|| AppError::invalid_request("The export operation is no longer active."))?
            .store(true, Ordering::Release);
        Ok(())
    }

    pub fn finish_operation(&self, operation_id: &str) -> Result<(), AppError> {
        self.operations
            .lock()
            .map_err(|_| AppError::internal("The in-memory operation registry is unavailable."))?
            .remove(operation_id);
        Ok(())
    }

    pub fn complete_source_replacement(
        &self,
        generation: u64,
        source: ValidatedSource,
    ) -> Result<String, AppError> {
        let mut session = self.lock_session()?;
        if session.latest_generation != generation {
            return Err(AppError::source_replaced());
        }

        let source_id = format!("source-{generation}");
        session.active_source = Some(ActiveSourceRecord {
            source_id: source_id.clone(),
            path: source.path,
            cancellation: Arc::new(AtomicBool::new(false)),
            media: None,
            preview_streams: None,
            preview: None,
            audio_previews: HashMap::new(),
            audio_stream_indexes: Vec::new(),
            waveform_job: None,
            waveforms: HashMap::new(),
        });

        Ok(source_id)
    }

    pub fn resolve_source(&self, source_id: &str) -> Result<ActiveSource, AppError> {
        let session = self.lock_session()?;
        session
            .active_source
            .as_ref()
            .filter(|source| source.source_id == source_id)
            .map(|source| ActiveSource {
                source_id: source.source_id.clone(),
                path: source.path.clone(),
                cancellation: Arc::clone(&source.cancellation),
                media: source.media.clone(),
                preview_streams: source.preview_streams,
                audio_stream_indexes: source.audio_stream_indexes.clone(),
            })
            .ok_or_else(AppError::source_replaced)
    }

    pub fn remember_inspected_streams(
        &self,
        source_id: &str,
        media: MediaInfo,
        preview_streams: PreviewStreamSelection,
        audio_stream_indexes: Vec<u32>,
    ) -> Result<(), AppError> {
        let mut session = self.lock_session()?;
        let source = active_source_mut(&mut session, source_id)?;
        source.media = Some(media);
        source.preview_streams = Some(preview_streams);
        source.audio_stream_indexes = audio_stream_indexes;
        Ok(())
    }

    pub fn begin_waveform_job(
        &self,
        source_id: &str,
        job_id: String,
    ) -> Result<WaveformSource, AppError> {
        if job_id.is_empty()
            || job_id.len() > 64
            || !job_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(AppError::invalid_request("The waveform job ID is invalid."));
        }

        let mut session = self.lock_session()?;
        let source = active_source_mut(&mut session, source_id)?;
        if let Some(previous_job) = source.waveform_job.take() {
            previous_job.cancellation.store(true, Ordering::Release);
        }

        let cancellation = Arc::new(AtomicBool::new(false));
        source.waveform_job = Some(WaveformJobRecord {
            job_id: job_id.clone(),
            cancellation: Arc::clone(&cancellation),
        });

        Ok(WaveformSource {
            source: ActiveSource {
                source_id: source.source_id.clone(),
                path: source.path.clone(),
                cancellation: Arc::clone(&source.cancellation),
                media: source.media.clone(),
                preview_streams: source.preview_streams,
                audio_stream_indexes: source.audio_stream_indexes.clone(),
            },
            cancellation,
        })
    }

    pub fn install_waveform(
        &self,
        source_id: &str,
        job_id: &str,
        stream_index: u32,
        width: u32,
        artifact: WaveformArtifact,
    ) -> Result<(), AppError> {
        let previous_waveform = {
            let mut session = self.lock_session()?;
            let source = active_source_mut(&mut session, source_id)?;
            let job_is_active = source.waveform_job.as_ref().is_some_and(|job| {
                job.job_id == job_id && !job.cancellation.load(Ordering::Acquire)
            });
            if source.cancellation.load(Ordering::Acquire) || !job_is_active {
                return Err(AppError::source_replaced());
            }
            source
                .waveforms
                .insert(stream_index, WaveformRecord { width, artifact })
        };
        drop(previous_waveform);
        Ok(())
    }

    pub fn waveform_is_ready(
        &self,
        source_id: &str,
        stream_index: u32,
        width: u32,
    ) -> Result<bool, AppError> {
        let session = self.lock_session()?;
        let source = active_source(&session, source_id)?;
        Ok(source
            .waveforms
            .get(&stream_index)
            .is_some_and(|waveform| waveform.width == width))
    }

    pub fn resolve_waveform_path(
        &self,
        source_id: &str,
        stream_index: u32,
    ) -> Result<PathBuf, AppError> {
        let session = self.lock_session()?;
        let source = active_source(&session, source_id)?;
        source
            .waveforms
            .get(&stream_index)
            .map(|waveform| waveform.artifact.path().to_owned())
            .ok_or_else(|| AppError::invalid_request("The waveform is not available."))
    }

    pub fn install_preview(
        &self,
        source_id: &str,
        preview: PreviewArtifact,
    ) -> Result<(), AppError> {
        let previous_preview = {
            let mut session = self.lock_session()?;
            let source = active_source_mut(&mut session, source_id)?;
            if source.cancellation.load(Ordering::Acquire) {
                return Err(AppError::source_replaced());
            }
            source.preview.replace(preview)
        };
        drop(previous_preview);
        Ok(())
    }

    pub fn install_audio_preview(
        &self,
        source_id: &str,
        stream_index: u32,
        preview: AudioPreviewArtifact,
    ) -> Result<(), AppError> {
        let previous_preview = {
            let mut session = self.lock_session()?;
            let source = active_source_mut(&mut session, source_id)?;
            if source.cancellation.load(Ordering::Acquire) {
                return Err(AppError::source_replaced());
            }
            source.audio_previews.insert(stream_index, preview)
        };
        drop(previous_preview);
        Ok(())
    }

    pub fn resolve_audio_preview_path(
        &self,
        source_id: &str,
        stream_index: u32,
    ) -> Result<PathBuf, AppError> {
        let session = self.lock_session()?;
        let source = session
            .active_source
            .as_ref()
            .filter(|source| source.source_id == source_id)
            .ok_or_else(AppError::source_replaced)?;
        source
            .audio_previews
            .get(&stream_index)
            .map(|preview| preview.path().to_owned())
            .ok_or_else(|| AppError::invalid_request("The audio preview is not available."))
    }

    pub fn resolve_preview_path(&self, source_id: &str) -> Result<PathBuf, AppError> {
        let session = self.lock_session()?;
        let source = session
            .active_source
            .as_ref()
            .filter(|source| source.source_id == source_id)
            .ok_or_else(AppError::source_replaced)?;
        Ok(source
            .preview
            .as_ref()
            .map_or_else(|| source.path.clone(), |preview| preview.path().to_owned()))
    }

    pub fn preview_is_ready(&self, source_id: &str) -> Result<bool, AppError> {
        let session = self.lock_session()?;
        let source = session
            .active_source
            .as_ref()
            .filter(|source| source.source_id == source_id)
            .ok_or_else(AppError::source_replaced)?;
        Ok(source.preview.is_some())
    }

    fn lock_session(&self) -> Result<std::sync::MutexGuard<'_, SessionState>, AppError> {
        self.session
            .lock()
            .map_err(|_| AppError::internal("The in-memory editing session is unavailable."))
    }
}

fn active_source<'a>(
    session: &'a SessionState,
    source_id: &str,
) -> Result<&'a ActiveSourceRecord, AppError> {
    session
        .active_source
        .as_ref()
        .filter(|source| source.source_id == source_id)
        .ok_or_else(AppError::source_replaced)
}

fn active_source_mut<'a>(
    session: &'a mut SessionState,
    source_id: &str,
) -> Result<&'a mut ActiveSourceRecord, AppError> {
    session
        .active_source
        .as_mut()
        .filter(|source| source.source_id == source_id)
        .ok_or_else(AppError::source_replaced)
}

#[cfg(test)]
mod tests {
    use std::{path::PathBuf, sync::atomic::Ordering};

    use crate::domain::source::ValidatedSource;

    use super::AppState;

    fn source(name: &str) -> ValidatedSource {
        ValidatedSource {
            path: PathBuf::from(name),
        }
    }

    #[test]
    fn newer_import_invalidates_an_older_completion() {
        let state = AppState::default();
        let first = state
            .begin_source_replacement()
            .expect("first import starts");
        let second = state
            .begin_source_replacement()
            .expect("replacement import starts");

        let error = state
            .complete_source_replacement(first, source("first.mp4"))
            .expect_err("stale import must fail");
        assert_eq!(error.code, "source_replaced");

        let source_id = state
            .complete_source_replacement(second, source("second.mp4"))
            .expect("latest import completes");
        assert!(state.resolve_source(&source_id).is_ok());
    }

    #[test]
    fn starting_replacement_removes_the_previous_source() {
        let state = AppState::default();
        let first = state
            .begin_source_replacement()
            .expect("first import starts");
        let source_id = state
            .complete_source_replacement(first, source("first.mp4"))
            .expect("first import completes");

        state
            .begin_source_replacement()
            .expect("replacement import starts");

        assert!(state.resolve_source(&source_id).is_err());
    }

    #[test]
    fn starting_replacement_cancels_work_for_the_previous_source() {
        let state = AppState::default();
        let generation = state.begin_source_replacement().expect("import starts");
        let source_id = state
            .complete_source_replacement(generation, source("first.mp4"))
            .expect("import completes");
        let cancellation = state
            .resolve_source(&source_id)
            .expect("source is active")
            .cancellation;

        state
            .begin_source_replacement()
            .expect("replacement import starts");

        assert!(cancellation.load(Ordering::Acquire));
    }

    #[test]
    fn newer_waveform_job_cancels_the_previous_job() {
        let state = AppState::default();
        let generation = state.begin_source_replacement().expect("import starts");
        let source_id = state
            .complete_source_replacement(generation, source("first.mp4"))
            .expect("import completes");
        let first_job = state
            .begin_waveform_job(&source_id, "waveform-1".to_owned())
            .expect("first waveform job starts");

        state
            .begin_waveform_job(&source_id, "waveform-2".to_owned())
            .expect("replacement waveform job starts");

        assert!(first_job.cancellation.load(Ordering::Acquire));
    }
}
