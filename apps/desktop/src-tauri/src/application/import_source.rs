use std::path::PathBuf;

use crate::{
    domain::source::{SourceRef, validate_source},
    error::AppError,
    state::AppState,
};

pub fn import_source(state: &AppState, path: PathBuf) -> Result<SourceRef, AppError> {
    let generation = state.begin_source_replacement()?;
    let source = validate_source(&path)?;
    let load_token = state.complete_source_replacement(generation, source)?;
    let active_source = state.resolve_source_by_load_token(load_token)?;
    let display_name = active_source
        .path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::internal("The active source has no usable file name."))?;

    Ok(SourceRef {
        display_name,
        source_path: active_source.path.display().to_string(),
    })
}
