use std::{
    ffi::{OsStr, OsString},
    io,
    time::Duration,
};

use serde::Serialize;
use which::which;

use crate::process::run_bounded;

const CAPABILITY_TIMEOUT: Duration = Duration::from_secs(3);
const CAPABILITY_OUTPUT_LIMIT: usize = 16 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryCapability {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCapabilities {
    pub ffmpeg: BinaryCapability,
    pub ffprobe: BinaryCapability,
}

pub fn check_media_capabilities() -> MediaCapabilities {
    MediaCapabilities {
        ffmpeg: check_binary("ffmpeg"),
        ffprobe: check_binary("ffprobe"),
    }
}

fn check_binary(executable: &str) -> BinaryCapability {
    let arguments = [OsString::from("-version")];
    match run_bounded(
        OsStr::new(executable),
        &arguments,
        CAPABILITY_TIMEOUT,
        CAPABILITY_OUTPUT_LIMIT,
        CAPABILITY_OUTPUT_LIMIT,
    ) {
        Ok(output) if output.status.success() => {
            let version = first_non_empty_line(&output.stdout).map(|version| {
                if output.stdout_truncated {
                    format!("{version} [output truncated]")
                } else {
                    version
                }
            });
            available_capability(version, resolved_path(executable))
        }
        Ok(output) => {
            let detail = first_non_empty_line(&output.stderr).map(|detail| {
                if output.stderr_truncated {
                    format!(" {detail} [diagnostics truncated]")
                } else {
                    format!(" {detail}")
                }
            });
            BinaryCapability {
                available: false,
                path: None,
                version: None,
                error: Some(format!(
                    "{executable} did not start successfully.{}",
                    detail.unwrap_or_default()
                )),
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => BinaryCapability {
            available: false,
            path: None,
            version: None,
            error: Some(format!(
                "{executable} is not installed or available on PATH."
            )),
        },
        Err(error) if error.kind() == io::ErrorKind::TimedOut => BinaryCapability {
            available: false,
            path: None,
            version: None,
            error: Some(format!("{executable} did not respond within 3 seconds.")),
        },
        Err(_) => BinaryCapability {
            available: false,
            path: None,
            version: None,
            error: Some(format!("{executable} could not be checked.")),
        },
    }
}

fn resolved_path(executable: &str) -> Option<String> {
    which(executable)
        .ok()
        .map(|path| path.to_string_lossy().into_owned())
}

fn available_capability(version: Option<String>, path: Option<String>) -> BinaryCapability {
    BinaryCapability {
        available: true,
        path,
        version,
        error: None,
    }
}

fn first_non_empty_line(output: &[u8]) -> Option<String> {
    String::from_utf8_lossy(output)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::{BinaryCapability, available_capability, check_binary, first_non_empty_line};

    #[test]
    fn extracts_the_version_header() {
        assert_eq!(
            first_non_empty_line(b"\nffprobe version 7.1\ncopyright"),
            Some("ffprobe version 7.1".to_owned())
        );
    }

    #[test]
    fn reports_a_missing_binary_without_failing_the_check() {
        let capability = check_binary("easytrim-binary-that-does-not-exist");

        assert!(!capability.available);
        assert!(capability.error.is_some());
    }

    #[test]
    fn keeps_a_binary_available_when_path_metadata_is_missing() {
        let capability = available_capability(Some("ffmpeg version 7.1".to_owned()), None);

        assert!(capability.available);
        assert_eq!(capability.path, None);
    }

    #[test]
    fn serializes_path_only_when_it_was_resolved() {
        let with_path = BinaryCapability {
            available: true,
            path: Some("C:/Tools/ffmpeg.exe".to_owned()),
            version: Some("ffmpeg version 7.1".to_owned()),
            error: None,
        };
        let without_path = available_capability(None, None);

        assert_eq!(
            serde_json::to_value(with_path).expect("capability serializes")["path"],
            "C:/Tools/ffmpeg.exe"
        );
        assert!(
            serde_json::to_value(without_path)
                .expect("capability serializes")
                .get("path")
                .is_none()
        );
    }
}
