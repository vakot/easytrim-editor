use std::path::PathBuf;

use crate::{
    domain::source::{SourceRef, validate_source},
    error::AppError,
    state::AppState,
};

pub fn activate_source(state: &AppState, path: PathBuf) -> Result<SourceRef, AppError> {
    let generation = state.begin_source_replacement()?;
    let validated = validate_source(&path)?;
    let load_token = state.complete_source_replacement(generation, validated)?;
    let active_source = state.resolve_source_by_load_token(load_token)?;
    source_ref_from_path(active_source.path)
}

fn source_ref_from_path(path: PathBuf) -> Result<SourceRef, AppError> {
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::internal("The selected source has no usable file name."))?;

    Ok(SourceRef {
        display_name,
        source_path: path.display().to_string(),
    })
}
