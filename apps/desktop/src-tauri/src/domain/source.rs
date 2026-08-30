use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

use crate::error::AppError;

pub const SUPPORTED_VIDEO_EXTENSIONS: &[&str] = &[
    "avi", "flv", "m2ts", "m4v", "mkv", "mov", "mp4", "mts", "ts", "webm", "wmv",
];

#[derive(Clone, Debug)]
pub struct ValidatedSource {
    pub path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceRef {
    pub display_name: String,
    pub source_path: String,
}

pub fn validate_source(path: &Path) -> Result<ValidatedSource, AppError> {
    let canonical_path = fs::canonicalize(path)
        .map_err(|_| AppError::io_failed("The selected video could not be opened."))?;

    if !canonical_path.is_file() {
        return Err(AppError::invalid_request(
            "Select a video file instead of a folder.",
        ));
    }

    if !is_supported_video_path(&canonical_path) {
        return Err(AppError::unsupported_media(
            "This file type is not supported yet.",
        ));
    }

    canonical_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::invalid_request("The selected video has no usable file name."))?;

    Ok(ValidatedSource {
        path: canonical_path,
    })
}

pub(crate) fn is_supported_video_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            SUPPORTED_VIDEO_EXTENSIONS
                .iter()
                .any(|supported| extension.eq_ignore_ascii_case(supported))
        })
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{SUPPORTED_VIDEO_EXTENSIONS, is_supported_video_path};

    #[test]
    fn supported_extensions_are_unique_and_sorted() {
        assert!(
            SUPPORTED_VIDEO_EXTENSIONS
                .windows(2)
                .all(|pair| pair[0] < pair[1])
        );
    }

    #[test]
    fn extension_check_is_case_insensitive_and_rejects_unknown_types() {
        assert!(is_supported_video_path(Path::new("Holiday.MP4")));
        assert!(!is_supported_video_path(Path::new("notes.txt")));
        assert!(!is_supported_video_path(Path::new("video")));
    }
}
