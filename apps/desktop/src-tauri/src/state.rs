use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};

use crate::{domain::source::ValidatedSource, error::AppError};

#[derive(Clone, Debug)]
pub struct ActiveSource {
    pub source_id: String,
    pub path: PathBuf,
    pub cancellation: Arc<AtomicBool>,
    pub preview_streams: Option<PreviewStreamSelection>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PreviewStreamSelection {
    pub video_stream_index: u32,
    pub audio_stream_index: Option<u32>,
}

#[derive(Debug)]
pub struct PreviewArtifact {
    directory: PathBuf,
    path: PathBuf,
}

impl PreviewArtifact {
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

impl Drop for PreviewArtifact {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
        let _ = fs::remove_dir(&self.directory);
    }
}

#[derive(Debug)]
struct ActiveSourceRecord {
    source_id: String,
    path: PathBuf,
    cancellation: Arc<AtomicBool>,
    preview_streams: Option<PreviewStreamSelection>,
    preview: Option<PreviewArtifact>,
}

#[derive(Debug, Default)]
struct SessionState {
    active_source: Option<ActiveSourceRecord>,
    latest_generation: u64,
}

#[derive(Debug, Default)]
pub struct AppState {
    next_generation: AtomicU64,
    session: Mutex<SessionState>,
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
        Ok(generation)
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
            preview_streams: None,
            preview: None,
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
                preview_streams: source.preview_streams,
            })
            .ok_or_else(AppError::source_replaced)
    }

    pub fn remember_preview_streams(
        &self,
        source_id: &str,
        preview_streams: PreviewStreamSelection,
    ) -> Result<(), AppError> {
        let mut session = self.lock_session()?;
        let source = active_source_mut(&mut session, source_id)?;
        source.preview_streams = Some(preview_streams);
        Ok(())
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
}
