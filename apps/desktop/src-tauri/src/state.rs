use std::{
    path::PathBuf,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
};

use crate::{domain::source::ValidatedSource, error::AppError};

#[derive(Clone, Debug)]
pub struct ActiveSource {
    pub source_id: String,
    pub path: PathBuf,
}

#[derive(Debug, Default)]
struct SessionState {
    active_source: Option<ActiveSource>,
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
        session.active_source = None;
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
        session.active_source = Some(ActiveSource {
            source_id: source_id.clone(),
            path: source.path,
        });

        Ok(source_id)
    }

    pub fn resolve_source(&self, source_id: &str) -> Result<ActiveSource, AppError> {
        let session = self.lock_session()?;
        session
            .active_source
            .as_ref()
            .filter(|source| source.source_id == source_id)
            .cloned()
            .ok_or_else(AppError::source_replaced)
    }

    fn lock_session(&self) -> Result<std::sync::MutexGuard<'_, SessionState>, AppError> {
        self.session
            .lock()
            .map_err(|_| AppError::internal("The in-memory editing session is unavailable."))
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

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
}
