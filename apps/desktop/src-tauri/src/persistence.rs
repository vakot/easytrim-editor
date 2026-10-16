use std::{
    fs::{self, File},
    io::Write,
    path::Path,
};

use serde::Serialize;

/// What happened to an existing document that could not be used at startup.
#[derive(Debug, PartialEq, Eq)]
pub enum DocumentLoadIssue {
    /// The file was renamed aside and the store restarted from its default value.
    Quarantined { reason: &'static str },
    /// The file could not be read or moved aside; it is left untouched and this session keeps the
    /// store in memory only, so it never overwrites data it could not interpret.
    PersistenceDisabled { reason: &'static str },
}

/// The result of loading a versioned JSON document at startup.
#[derive(Debug)]
pub struct LoadedDocument<T> {
    pub value: T,
    /// Whether later updates may be written back to the document.
    pub persistent: bool,
    pub issue: Option<DocumentLoadIssue>,
}

/// Loads a JSON document that `decode` validates and migrates. Never fails: a missing file yields
/// the default value, and a document `decode` rejects with a reason is renamed aside to
/// `<stem>.<timestamp_millis>.<reason>.json` so the store can restart without losing it.
pub fn load_json_document<T: Default>(
    path: &Path,
    timestamp_millis: i64,
    decode: impl FnOnce(&[u8]) -> Result<T, &'static str>,
) -> LoadedDocument<T> {
    if let Some(directory) = path.parent() {
        let _ = fs::create_dir_all(directory);
    }
    let reason = match fs::read(path) {
        Ok(bytes) => match decode(&bytes) {
            Ok(value) => {
                return LoadedDocument {
                    value,
                    persistent: true,
                    issue: None,
                };
            }
            Err(reason) => reason,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return LoadedDocument {
                value: T::default(),
                persistent: true,
                issue: None,
            };
        }
        Err(_) => {
            return LoadedDocument {
                value: T::default(),
                persistent: false,
                issue: Some(DocumentLoadIssue::PersistenceDisabled {
                    reason: "unreadable",
                }),
            };
        }
    };
    let stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default();
    let quarantine = path.with_file_name(format!("{stem}.{timestamp_millis}.{reason}.json"));
    let quarantined = fs::rename(path, quarantine).is_ok();
    LoadedDocument {
        value: T::default(),
        persistent: quarantined,
        issue: Some(if quarantined {
            DocumentLoadIssue::Quarantined { reason }
        } else {
            DocumentLoadIssue::PersistenceDisabled { reason }
        }),
    }
}

/// Writes JSON through a synced temporary file and an atomic replace, so readers observe either
/// the previous document or the complete new one.
pub fn write_json_atomic(path: &Path, value: &impl Serialize) -> std::io::Result<()> {
    let temporary = path.with_extension("tmp");
    let bytes = serde_json::to_vec_pretty(value).map_err(std::io::Error::other)?;
    {
        let mut file = File::create(&temporary)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
    }
    replace_file(&temporary, path)
}

#[cfg(not(target_os = "windows"))]
fn replace_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::rename(source, destination)
}

#[cfg(target_os = "windows")]
fn replace_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::Storage::FileSystem::{
        MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
    };

    let source = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}
