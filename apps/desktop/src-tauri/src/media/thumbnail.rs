use std::{
    ffi::{OsStr, OsString},
    fs::{self, File, FileTimes, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    process,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use image::{DynamicImage, RgbImage, codecs::jpeg::JpegEncoder, imageops::FilterType};
use sha2::{Digest, Sha256};

use crate::{
    error::AppError,
    process::{ProcessOutput, run_bounded_cancellable},
    state::{ImportedThumbnailArtifact, PreviewArtifact},
};

#[cfg(windows)]
use super::windows_thumbnail::{cached_thumbnail, extract_thumbnail};

pub const THUMBNAIL_WIDTH: u32 = 640;
pub const THUMBNAIL_HEIGHT: u32 = 360;

const THUMBNAIL_TIMEOUT: Duration = Duration::from_secs(60);
const THUMBNAIL_STDOUT_LIMIT: usize = 16 * 1024;
const THUMBNAIL_STDERR_LIMIT: usize = 128 * 1024;
const THUMBNAIL_CACHE_MAX_BYTES: u64 = 512 * 1024 * 1024;
const THUMBNAIL_CACHE_MAX_FILES: usize = 4_096;
const STALE_CACHE_TEMP_MAX_AGE: Duration = Duration::from_secs(60 * 60);
static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

pub fn generate_thumbnail(
    source_path: &Path,
    cache_directory: &Path,
) -> Result<ImportedThumbnailArtifact, AppError> {
    let key = thumbnail_cache_key(source_path)?;
    let cached_path = cache_directory.join(format!("{key}.jpg"));
    if is_usable_cache_entry(&cached_path) {
        touch_cache_entry(&cached_path);
        return Ok(ImportedThumbnailArtifact::from_cache(cached_path));
    }

    #[cfg(windows)]
    {
        if let Some(bytes) = cached_thumbnail(source_path) {
            if let Some(path) = write_cached_thumbnail(cache_directory, &key, &bytes) {
                return Ok(ImportedThumbnailArtifact::from_cache(path));
            }
            return write_temporary_thumbnail(&bytes);
        }

        if let Some(bytes) = extract_thumbnail(source_path) {
            if let Some(path) = write_cached_thumbnail(cache_directory, &key, &bytes) {
                return Ok(ImportedThumbnailArtifact::from_cache(path));
            }
            return write_temporary_thumbnail(&bytes);
        }
    }

    let artifact = generate_ffmpeg_thumbnail(source_path)?;
    let mut bytes = Vec::new();
    if File::open(artifact.path())
        .and_then(|mut file| file.read_to_end(&mut bytes))
        .is_ok()
        && let Some(path) = write_cached_thumbnail(cache_directory, &key, &bytes)
    {
        return Ok(ImportedThumbnailArtifact::from_cache(path));
    }

    Ok(ImportedThumbnailArtifact::from_temporary(artifact))
}

fn thumbnail_cache_key(source_path: &Path) -> Result<String, AppError> {
    let canonical_path = fs::canonicalize(source_path)
        .map_err(|_| AppError::io_failed("The source file is no longer available."))?;
    let metadata = fs::metadata(&canonical_path)
        .map_err(|_| AppError::io_failed("The source file metadata is unavailable."))?;
    let modified_nanos = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_nanos());

    let mut hasher = Sha256::new();
    hasher.update(canonical_path.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified_nanos.to_le_bytes());
    hasher.update(THUMBNAIL_WIDTH.to_le_bytes());
    hasher.update(THUMBNAIL_HEIGHT.to_le_bytes());

    Ok(format!("{:x}", hasher.finalize()))
}

fn is_usable_cache_entry(path: &Path) -> bool {
    if !path.is_file() || !fs::metadata(path).is_ok_and(|metadata| metadata.len() > 0) {
        return false;
    }

    image::ImageReader::open(path)
        .ok()
        .and_then(|reader| reader.into_dimensions().ok())
        .is_some_and(|(width, height)| width == THUMBNAIL_WIDTH && height == THUMBNAIL_HEIGHT)
}

fn touch_cache_entry(path: &Path) {
    if let Ok(file) = OpenOptions::new().write(true).open(path) {
        let times = FileTimes::new().set_modified(SystemTime::now());
        let _ = file.set_times(times);
    }
}

fn write_cached_thumbnail(cache_directory: &Path, key: &str, bytes: &[u8]) -> Option<PathBuf> {
    if bytes.is_empty() || fs::create_dir_all(cache_directory).is_err() {
        return None;
    }

    let cache_path = cache_directory.join(format!("{key}.jpg"));
    if is_usable_cache_entry(&cache_path) {
        touch_cache_entry(&cache_path);
        return Some(cache_path);
    }

    let sequence = NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
    let temporary_path = cache_directory.join(format!("{key}-{}-{sequence}.tmp", process::id()));
    let write_result = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .and_then(|mut file| {
            file.write_all(bytes)?;
            file.sync_all()
        });

    if write_result.is_err() {
        let _ = fs::remove_file(temporary_path);
        return None;
    }

    match fs::rename(&temporary_path, &cache_path) {
        Ok(()) => {}
        Err(_) if is_usable_cache_entry(&cache_path) => {
            let _ = fs::remove_file(temporary_path);
        }
        Err(_) => {
            let _ = fs::remove_file(temporary_path);
            return None;
        }
    }

    trim_thumbnail_cache(cache_directory);
    Some(cache_path)
}

fn trim_thumbnail_cache(cache_directory: &Path) {
    trim_thumbnail_cache_with_limits(
        cache_directory,
        THUMBNAIL_CACHE_MAX_BYTES,
        THUMBNAIL_CACHE_MAX_FILES,
    );
}

fn trim_thumbnail_cache_with_limits(cache_directory: &Path, max_bytes: u64, max_files: usize) {
    let Ok(entries) = fs::read_dir(cache_directory) else {
        return;
    };

    let mut entries = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            if !metadata.is_file() {
                return None;
            }

            if path.extension().is_some_and(|extension| extension == "tmp") {
                let modified = metadata.modified().unwrap_or(UNIX_EPOCH);
                return modified
                    .elapsed()
                    .is_ok_and(|age| age >= STALE_CACHE_TEMP_MAX_AGE)
                    .then_some((path, metadata.len(), modified));
            }
            if path.extension().is_none_or(|extension| extension != "jpg") {
                return None;
            }

            Some((
                path,
                metadata.len(),
                metadata.modified().unwrap_or(UNIX_EPOCH),
            ))
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|(_, _, modified)| *modified);

    let mut total_bytes = entries.iter().map(|(_, size, _)| *size).sum::<u64>();
    let mut file_count = entries.len();
    for (path, size, _) in entries {
        if total_bytes <= max_bytes && file_count <= max_files {
            break;
        }
        if fs::remove_file(path).is_ok() {
            total_bytes = total_bytes.saturating_sub(size);
            file_count = file_count.saturating_sub(1);
        }
    }
}

fn write_temporary_thumbnail(bytes: &[u8]) -> Result<ImportedThumbnailArtifact, AppError> {
    let artifact = create_artifact("jpg")?;
    fs::write(artifact.path(), bytes)
        .map_err(|_| AppError::io_failed("The thumbnail could not be saved temporarily."))?;
    Ok(ImportedThumbnailArtifact::from_temporary(artifact))
}

pub(super) fn encode_rgb_thumbnail(image: RgbImage) -> Result<Vec<u8>, AppError> {
    encode_thumbnail(DynamicImage::ImageRgb8(image))
}

fn encode_thumbnail(image: DynamicImage) -> Result<Vec<u8>, AppError> {
    let image = image.resize_to_fill(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, FilterType::Lanczos3);
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, 85)
        .encode_image(&image)
        .map_err(|_| {
            AppError::preview_failed("The thumbnail could not be encoded.", None::<String>)
        })?;
    Ok(bytes)
}

fn generate_ffmpeg_thumbnail(source_path: &Path) -> Result<PreviewArtifact, AppError> {
    let artifact = create_artifact("jpg")?;
    let arguments = thumbnail_arguments(source_path, artifact.path());
    let output = run_bounded_cancellable(
        OsStr::new("ffmpeg"),
        &arguments,
        THUMBNAIL_TIMEOUT,
        THUMBNAIL_STDOUT_LIMIT,
        THUMBNAIL_STDERR_LIMIT,
        || false,
    )
    .map_err(process_error)?;

    if output.status.success()
        && artifact.path().is_file()
        && fs::metadata(artifact.path()).is_ok_and(|metadata| metadata.len() > 0)
    {
        return Ok(artifact);
    }

    Err(AppError::preview_failed(
        "A thumbnail could not be prepared for this video.",
        diagnostics(&output, source_path, artifact.path()),
    ))
}

fn thumbnail_arguments(source_path: &Path, output_path: &Path) -> Vec<OsString> {
    vec![
        OsString::from("-hide_banner"),
        OsString::from("-nostdin"),
        OsString::from("-nostats"),
        OsString::from("-threads"),
        OsString::from("1"),
        OsString::from("-filter_threads"),
        OsString::from("1"),
        OsString::from("-filter_complex_threads"),
        OsString::from("1"),
        OsString::from("-n"),
        OsString::from("-i"),
        source_path.as_os_str().to_owned(),
        OsString::from("-map"),
        OsString::from("0:v:0"),
        OsString::from("-frames:v"),
        OsString::from("1"),
        OsString::from("-vf"),
        OsString::from(format!(
            "scale={THUMBNAIL_WIDTH}:{THUMBNAIL_HEIGHT}:force_original_aspect_ratio=increase,crop={THUMBNAIL_WIDTH}:{THUMBNAIL_HEIGHT}"
        )),
        OsString::from("-an"),
        OsString::from("-sn"),
        OsString::from("-dn"),
        OsString::from("-c:v"),
        OsString::from("mjpeg"),
        OsString::from("-q:v"),
        OsString::from("4"),
        OsString::from("-f"),
        OsString::from("image2"),
        OsString::from("-update"),
        OsString::from("1"),
        output_path.as_os_str().to_owned(),
    ]
}

pub(super) fn create_artifact(extension: &str) -> Result<PreviewArtifact, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let base_directory = std::env::temp_dir();

    for _ in 0..100 {
        let sequence = NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
        let directory = base_directory.join(format!(
            "easytrim-thumbnail-{}-{timestamp}-{sequence}",
            process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => {
                return PreviewArtifact::new(
                    directory.clone(),
                    directory.join(format!("thumbnail.{extension}")),
                );
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(_) => {
                return Err(AppError::io_failed(
                    "A temporary thumbnail directory could not be created.",
                ));
            }
        }
    }

    Err(AppError::io_failed(
        "A unique temporary thumbnail directory could not be created.",
    ))
}

fn process_error(error: io::Error) -> AppError {
    let message = match error.kind() {
        io::ErrorKind::NotFound => "FFmpeg is required to prepare source thumbnails.",
        io::ErrorKind::TimedOut => "Preparing a source thumbnail took too long.",
        _ => "FFmpeg could not prepare a source thumbnail.",
    };
    AppError::preview_failed(message, None::<String>)
}

fn diagnostics(
    output: &ProcessOutput,
    source_path: &Path,
    thumbnail_path: &Path,
) -> Option<String> {
    let value = String::from_utf8_lossy(&output.stderr);
    let value = value
        .replace(source_path.to_string_lossy().as_ref(), "<source>")
        .replace(thumbnail_path.to_string_lossy().as_ref(), "<thumbnail>");
    let value = value.trim();
    (!value.is_empty()).then(|| {
        if output.stderr_truncated {
            format!("{value}\n[diagnostics truncated]")
        } else {
            value.to_owned()
        }
    })
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::Path,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    use image::{Rgb, RgbImage};

    use super::{
        THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH, encode_rgb_thumbnail, generate_thumbnail,
        is_usable_cache_entry, thumbnail_arguments, thumbnail_cache_key,
        trim_thumbnail_cache_with_limits, write_cached_thumbnail,
    };

    struct TestDirectory(std::path::PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir()
                .join(format!("easytrim-thumbnail-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).expect("create thumbnail test directory");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn ffmpeg_generates_one_video_frame_cropped_to_fixed_16_by_9_size() {
        let arguments = thumbnail_arguments(
            Path::new("C:\\Media\\clip.mp4"),
            Path::new("C:\\Temp\\thumbnail.jpg"),
        );
        let arguments = arguments
            .iter()
            .map(|argument| argument.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        assert!(arguments.windows(2).any(|pair| pair == ["-map", "0:v:0"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-frames:v", "1"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-c:v", "mjpeg"]));
        assert!(arguments.iter().any(|argument| {
            argument.contains("scale=640:360:force_original_aspect_ratio=increase,crop=640:360")
        }));
    }

    #[test]
    fn shell_thumbnail_encoding_centers_and_crops_to_640_by_360() {
        let mut image = RgbImage::new(800, 360);
        for (x, _, pixel) in image.enumerate_pixels_mut() {
            *pixel = if !(200..600).contains(&x) {
                Rgb([255, 0, 0])
            } else {
                Rgb([0, 0, 255])
            };
        }

        let encoded = encode_rgb_thumbnail(image).expect("thumbnail encodes");
        let decoded = image::load_from_memory(&encoded).expect("encoded thumbnail decodes");
        assert_eq!(decoded.width(), THUMBNAIL_WIDTH);
        assert_eq!(decoded.height(), THUMBNAIL_HEIGHT);
        let center = decoded.to_rgb8().get_pixel(320, 180).0;
        assert!(center[2] > center[0]);
    }

    #[test]
    fn app_cache_accepts_only_fixed_size_thumbnails() {
        let directory = TestDirectory::new();
        let valid_path = directory.0.join("valid.jpg");
        let invalid_path = directory.0.join("invalid.jpg");
        let valid = encode_rgb_thumbnail(RgbImage::new(1, 1)).expect("encode test thumbnail");
        fs::write(&valid_path, valid).expect("write valid cached thumbnail");
        fs::write(&invalid_path, b"not a thumbnail").expect("write invalid cached thumbnail");

        assert!(is_usable_cache_entry(&valid_path));
        assert!(!is_usable_cache_entry(&invalid_path));
    }

    #[test]
    fn cache_key_changes_when_size_or_modified_time_changes() {
        let directory = TestDirectory::new();
        let path = directory.0.join("clip.mp4");
        fs::write(&path, b"one").expect("write fixture");
        let initial = thumbnail_cache_key(&path).expect("initial key");

        fs::write(&path, b"a longer fixture").expect("update fixture size");
        let changed_size = thumbnail_cache_key(&path).expect("size key");
        assert_ne!(initial, changed_size);

        let file = fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .expect("open fixture");
        file.set_times(std::fs::FileTimes::new().set_modified(SystemTime::now()))
            .expect("update fixture time");
        let changed_time = thumbnail_cache_key(&path).expect("time key");
        assert_ne!(changed_size, changed_time);
    }

    #[test]
    fn revisiting_an_evicted_runtime_thumbnail_reuses_the_disk_cache() {
        let directory = TestDirectory::new();
        let source_path = directory.0.join("clip.mp4");
        fs::write(&source_path, b"source fixture").expect("source fixture writes");
        let cache_directory = directory.0.join("thumbnails");
        let key = thumbnail_cache_key(&source_path).expect("cache key builds");
        let bytes = encode_rgb_thumbnail(RgbImage::new(1, 1)).expect("thumbnail encodes");
        let cached_path = write_cached_thumbnail(&cache_directory, &key, &bytes)
            .expect("disk thumbnail cache writes");

        let thumbnail = generate_thumbnail(&source_path, &cache_directory)
            .expect("thumbnail reuses the disk cache");

        assert_eq!(thumbnail.path(), cached_path);
    }

    #[test]
    fn cache_reuses_entries_and_trims_oldest_files_when_over_limit() {
        let directory = TestDirectory::new();
        let first = write_cached_thumbnail(&directory.0, &"a".repeat(64), b"first")
            .expect("first cache entry");
        let second = write_cached_thumbnail(&directory.0, &"b".repeat(64), b"second")
            .expect("second cache entry");

        assert_eq!(fs::read(&first).expect("read first"), b"first");
        assert_eq!(fs::read(&second).expect("read second"), b"second");
        fs::OpenOptions::new()
            .write(true)
            .open(&first)
            .expect("open first cache entry")
            .set_times(std::fs::FileTimes::new().set_modified(UNIX_EPOCH + Duration::from_secs(1)))
            .expect("age first cache entry");
        fs::OpenOptions::new()
            .write(true)
            .open(&second)
            .expect("open second cache entry")
            .set_times(std::fs::FileTimes::new().set_modified(UNIX_EPOCH + Duration::from_secs(2)))
            .expect("age second cache entry");
        trim_thumbnail_cache_with_limits(&directory.0, 8, 1);
        assert!(!first.exists());
        assert!(second.exists());
    }

    #[test]
    fn cache_cleanup_only_touches_its_own_directory() {
        let directory = TestDirectory::new();
        let thumbnail_cache = directory.0.join("thumbnails");
        fs::create_dir(&thumbnail_cache).expect("thumbnail cache directory creates");
        let cached = write_cached_thumbnail(&thumbnail_cache, &"c".repeat(64), b"thumbnail")
            .expect("cache entry writes");
        let unrelated = directory.0.join("other-cache-entry.jpg");
        fs::write(&unrelated, b"unrelated").expect("unrelated cache entry writes");

        trim_thumbnail_cache_with_limits(&thumbnail_cache, 0, 0);

        assert!(!cached.exists());
        assert!(unrelated.exists());
    }
}
