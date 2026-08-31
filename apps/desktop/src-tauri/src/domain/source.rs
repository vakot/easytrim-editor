use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

use crate::error::AppError;

pub const SUPPORTED_VIDEO_EXTENSIONS: &[&str] = &[
    "avi", "flv", "m2ts", "m4v", "mkv", "mov", "mp4", "mts", "ts", "webm", "wmv",
];

pub const MAX_IMPORT_RECURSION_DEPTH: usize = 32;
pub const MAX_IMPORT_VISITED_DIRECTORIES: usize = 10_000;
pub const MAX_IMPORT_DISCOVERED_FILES: usize = 100_000;

#[derive(Clone, Copy)]
struct ImportTraversalLimits {
    max_depth: usize,
    max_directories: usize,
    max_files: usize,
}

const DEFAULT_IMPORT_TRAVERSAL_LIMITS: ImportTraversalLimits = ImportTraversalLimits {
    max_depth: MAX_IMPORT_RECURSION_DEPTH,
    max_directories: MAX_IMPORT_VISITED_DIRECTORIES,
    max_files: MAX_IMPORT_DISCOVERED_FILES,
};

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

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceImportResult {
    pub accepted_file_count: usize,
    pub direct_file_count: usize,
    pub discovered_file_count: usize,
    pub folder_count: usize,
    pub recursive: bool,
    pub skipped_file_count: usize,
    pub sources: Vec<SourceRef>,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncation_reason: Option<String>,
    pub read_error_count: usize,
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

pub fn collect_source_import(paths: &[PathBuf]) -> SourceImportResult {
    collect_source_import_with_limits(paths, DEFAULT_IMPORT_TRAVERSAL_LIMITS)
}

fn collect_source_import_with_limits(
    paths: &[PathBuf],
    limits: ImportTraversalLimits,
) -> SourceImportResult {
    let mut result = SourceImportResult::default();
    let mut visited_directories = HashSet::new();

    for path in paths {
        match input_kind(path) {
            InputKind::Directory => {
                result.folder_count += 1;
                result.recursive = true;
                collect_directory(path, 0, &mut result, &mut visited_directories, limits);
            }
            InputKind::File | InputKind::Unknown => {
                result.direct_file_count += 1;
                collect_file(path, false, &mut result);
            }
        }
    }

    result.accepted_file_count = result.sources.len();
    result
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum InputKind {
    Directory,
    File,
    Unknown,
}

fn input_kind(path: &Path) -> InputKind {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return InputKind::Unknown;
    };
    if is_directory_link(path, &metadata) {
        return InputKind::Unknown;
    }
    if metadata.is_dir() {
        return InputKind::Directory;
    }
    if metadata.is_file() {
        return InputKind::File;
    }

    if metadata.file_type().is_symlink() {
        return fs::metadata(path)
            .map(|target| {
                if target.is_dir() {
                    InputKind::Unknown
                } else if target.is_file() {
                    InputKind::File
                } else {
                    InputKind::Unknown
                }
            })
            .unwrap_or(InputKind::Unknown);
    }

    InputKind::Unknown
}

fn collect_directory(
    directory: &Path,
    depth: usize,
    result: &mut SourceImportResult,
    visited_directories: &mut HashSet<PathBuf>,
    limits: ImportTraversalLimits,
) {
    if depth > limits.max_depth {
        mark_truncated(result, "depth_limit");
        return;
    }
    if result.discovered_file_count >= limits.max_files {
        mark_truncated(result, "file_count_limit");
        return;
    }

    let canonical = match fs::canonicalize(directory) {
        Ok(path) => path,
        Err(_) => {
            result.read_error_count += 1;
            return;
        }
    };
    if visited_directories.len() >= limits.max_directories {
        mark_truncated(result, "directory_count_limit");
        return;
    }
    if !visited_directories.insert(canonical) {
        return;
    }

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => {
            result.read_error_count += 1;
            return;
        }
    };

    for entry in entries {
        let Ok(entry) = entry else {
            result.read_error_count += 1;
            continue;
        };
        let path = entry.path();
        match input_kind(&path) {
            InputKind::Directory => {
                if depth == limits.max_depth {
                    mark_truncated(result, "depth_limit");
                    continue;
                }
                if visited_directories.len() >= limits.max_directories {
                    mark_truncated(result, "directory_count_limit");
                    break;
                }
                collect_directory(&path, depth + 1, result, visited_directories, limits);
            }
            InputKind::File => {
                if result.discovered_file_count >= limits.max_files {
                    mark_truncated(result, "file_count_limit");
                    break;
                }
                collect_file(&path, true, result);
            }
            InputKind::Unknown => {}
        }
        if result.truncated && result.truncation_reason.as_deref() == Some("file_count_limit") {
            break;
        }
    }
}

fn collect_file(path: &Path, discovered: bool, result: &mut SourceImportResult) {
    if discovered {
        result.discovered_file_count += 1;
    }
    if !is_supported_video_path(path) {
        result.skipped_file_count += 1;
        return;
    }

    match validate_source(path).and_then(|validated| source_ref_from_path(validated.path)) {
        Ok(source) => result.sources.push(source),
        Err(_) => result.skipped_file_count += 1,
    }
}

fn source_ref_from_path(path: PathBuf) -> Result<SourceRef, AppError> {
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::invalid_request("The selected source has no usable file name."))?;

    Ok(SourceRef {
        display_name,
        source_path: path.display().to_string(),
    })
}

fn mark_truncated(result: &mut SourceImportResult, reason: &str) {
    result.truncated = true;
    result
        .truncation_reason
        .get_or_insert_with(|| reason.to_owned());
}

fn is_directory_link(path: &Path, metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return fs::metadata(path).is_ok_and(|target| target.is_dir());
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        return metadata.file_attributes() & 0x400 != 0 && metadata.is_dir();
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::HashSet,
        fs,
        path::{Path, PathBuf},
    };

    use super::{
        ImportTraversalLimits, SUPPORTED_VIDEO_EXTENSIONS, collect_directory,
        collect_source_import, is_supported_video_path,
    };

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir()
                .join(format!("easytrim-source-import-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).expect("create test directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn file(path: &Path) {
        fs::write(path, b"test").expect("create test file");
    }

    fn limits(max_depth: usize, max_directories: usize, max_files: usize) -> ImportTraversalLimits {
        ImportTraversalLimits {
            max_depth,
            max_directories,
            max_files,
        }
    }

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

    #[test]
    fn collects_one_or_multiple_direct_files_without_folder_counts() {
        let directory = TestDirectory::new();
        let first = directory.path().join("first.mp4");
        let second = directory.path().join("second.MOV");
        file(&first);
        file(&second);

        let result = collect_source_import(&[first, second]);

        assert_eq!(result.direct_file_count, 2);
        assert_eq!(result.folder_count, 0);
        assert_eq!(result.discovered_file_count, 0);
        assert_eq!(result.accepted_file_count, 2);
        assert!(!result.recursive);
    }

    #[test]
    fn recursively_collects_nested_files_and_preserves_mixed_input_counts() {
        let directory = TestDirectory::new();
        let folder_one = directory.path().join("folder-one");
        let folder_two = directory.path().join("folder-two");
        let nested = folder_one.join("nested");
        fs::create_dir_all(&nested).expect("create nested directories");
        fs::create_dir(&folder_two).expect("create second folder");

        let direct = directory.path().join("direct.mp4");
        let unsupported = directory.path().join("notes.txt");
        let nested_file = nested.join("nested.mkv");
        let second_file = folder_two.join("second.webm");
        let second_unsupported = folder_two.join("image.png");
        file(&direct);
        file(&unsupported);
        file(&nested_file);
        file(&second_file);
        file(&second_unsupported);

        let result = collect_source_import(&[direct, unsupported, folder_one, folder_two]);

        assert_eq!(result.direct_file_count, 2);
        assert_eq!(result.folder_count, 2);
        assert_eq!(result.discovered_file_count, 3);
        assert_eq!(result.accepted_file_count, 3);
        assert_eq!(result.skipped_file_count, 2);
        assert!(result.recursive);
    }

    #[test]
    fn does_not_follow_directory_symlinks() {
        let directory = TestDirectory::new();
        let outside = directory.path().join("outside");
        let root = directory.path().join("root");
        let link = root.join("linked-directory");
        fs::create_dir(&outside).expect("create outside directory");
        fs::create_dir(&root).expect("create root directory");
        file(&outside.join("outside.mp4"));

        #[cfg(windows)]
        let linked = std::os::windows::fs::symlink_dir(&outside, &link);
        #[cfg(unix)]
        let linked = std::os::unix::fs::symlink(&outside, &link);

        if linked.is_err() {
            return;
        }

        let result = collect_source_import(&[root]);

        assert_eq!(result.folder_count, 1);
        assert_eq!(result.discovered_file_count, 0);
        assert_eq!(result.accepted_file_count, 0);
        assert!(!result.truncated);
    }

    #[test]
    fn truncates_at_depth_directory_and_file_limits_with_partial_success() {
        let directory = TestDirectory::new();
        let root = directory.path().join("root");
        fs::create_dir(&root).expect("create root directory");
        file(&root.join("root.mp4"));
        let depth_one = root.join("depth-one");
        let depth_two = depth_one.join("depth-two");
        fs::create_dir(&depth_one).expect("create first nested directory");
        fs::create_dir(&depth_two).expect("create second nested directory");
        file(&depth_two.join("too-deep.mp4"));

        let depth_result =
            super::collect_source_import_with_limits(&[root.clone()], limits(1, 100, 100));

        assert_eq!(depth_result.accepted_file_count, 1);
        assert_eq!(
            depth_result.truncation_reason.as_deref(),
            Some("depth_limit")
        );

        let file_root = directory.path().join("file-limit");
        fs::create_dir(&file_root).expect("create file-limit directory");
        file(&file_root.join("first.mp4"));
        file(&file_root.join("second.mp4"));
        let file_result =
            super::collect_source_import_with_limits(&[file_root], limits(10, 100, 1));
        assert_eq!(file_result.accepted_file_count, 1);
        assert_eq!(file_result.discovered_file_count, 1);
        assert_eq!(
            file_result.truncation_reason.as_deref(),
            Some("file_count_limit")
        );

        let directory_root = directory.path().join("directory-limit");
        fs::create_dir(&directory_root).expect("create directory-limit root");
        let partial = directory_root.join("partial.mp4");
        file(&partial);
        fs::create_dir(directory_root.join("child-one")).expect("create first child");
        fs::create_dir(directory_root.join("child-two")).expect("create second child");
        let directory_result = super::collect_source_import_with_limits(
            &[partial, directory_root],
            limits(10, 1, 100),
        );
        assert!(directory_result.accepted_file_count >= 1);
        assert_eq!(
            directory_result.truncation_reason.as_deref(),
            Some("directory_count_limit")
        );
    }

    #[test]
    fn read_errors_are_recorded_without_discarding_previous_files() {
        let directory = TestDirectory::new();
        let valid = directory.path().join("valid.mp4");
        file(&valid);
        let mut result = collect_source_import(&[valid]);
        let mut visited = HashSet::new();
        let missing_directory = directory.path().join("missing");

        collect_directory(
            &missing_directory,
            0,
            &mut result,
            &mut visited,
            limits(10, 100, 100),
        );

        assert_eq!(result.accepted_file_count, 1);
        assert_eq!(result.sources.len(), 1);
        assert_eq!(result.read_error_count, 1);
    }
}
