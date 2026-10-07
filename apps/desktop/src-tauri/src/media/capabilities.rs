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
    pub error_id: Option<BinaryCapabilityErrorId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BinaryCapabilityErrorId {
    NotFound,
    TimedOut,
    StartFailed,
    CheckFailed,
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
        Ok(output) => failed_capability(
            BinaryCapabilityErrorId::CheckFailed,
            output_diagnostics(&output.stderr, output.stderr_truncated),
        ),
        Err(error) => failed_capability(io_error_id(error.kind()), Some(error.to_string())),
    }
}

fn io_error_id(kind: io::ErrorKind) -> BinaryCapabilityErrorId {
    match kind {
        io::ErrorKind::NotFound => BinaryCapabilityErrorId::NotFound,
        io::ErrorKind::TimedOut => BinaryCapabilityErrorId::TimedOut,
        _ => BinaryCapabilityErrorId::StartFailed,
    }
}

fn failed_capability(
    error_id: BinaryCapabilityErrorId,
    diagnostics: Option<String>,
) -> BinaryCapability {
    BinaryCapability {
        available: false,
        path: None,
        version: None,
        error_id: Some(error_id),
        diagnostics,
    }
}

fn output_diagnostics(stderr: &[u8], truncated: bool) -> Option<String> {
    let detail = String::from_utf8_lossy(stderr).trim().to_owned();
    if detail.is_empty() && !truncated {
        return None;
    }
    if truncated {
        if detail.is_empty() {
            Some("[diagnostics truncated]".to_owned())
        } else {
            Some(format!("{detail}\n[diagnostics truncated]"))
        }
    } else {
        Some(detail)
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
        error_id: None,
        diagnostics: None,
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
    use std::io;

    use super::{
        BinaryCapability, BinaryCapabilityErrorId, available_capability, check_binary,
        failed_capability, first_non_empty_line, io_error_id, output_diagnostics,
    };

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
        assert_eq!(capability.error_id, Some(BinaryCapabilityErrorId::NotFound));
        assert!(capability.diagnostics.is_some());
    }

    #[test]
    fn classifies_timeout_and_start_failures_without_user_facing_text() {
        assert_eq!(
            io_error_id(io::ErrorKind::TimedOut),
            BinaryCapabilityErrorId::TimedOut
        );
        assert_eq!(
            io_error_id(io::ErrorKind::PermissionDenied),
            BinaryCapabilityErrorId::StartFailed
        );
    }

    #[test]
    fn keeps_nonzero_exit_stderr_separate_from_the_semantic_failure() {
        let capability = failed_capability(
            BinaryCapabilityErrorId::CheckFailed,
            output_diagnostics(b"codec initialization failed\n", false),
        );

        assert_eq!(
            capability.error_id,
            Some(BinaryCapabilityErrorId::CheckFailed)
        );
        assert_eq!(
            capability.diagnostics.as_deref(),
            Some("codec initialization failed")
        );
    }

    #[test]
    fn serializes_capability_error_ids_and_diagnostics_without_english_copy() {
        let capability = failed_capability(
            BinaryCapabilityErrorId::TimedOut,
            Some("process exceeded 3 second limit".to_owned()),
        );

        assert_eq!(
            serde_json::to_value(capability).expect("capability serializes"),
            serde_json::json!({
                "available": false,
                "errorId": "timedOut",
                "diagnostics": "process exceeded 3 second limit"
            })
        );
    }

    #[test]
    fn marks_truncated_stderr_in_diagnostics() {
        assert_eq!(
            output_diagnostics(b"stderr detail", true).as_deref(),
            Some("stderr detail\n[diagnostics truncated]")
        );
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
            error_id: None,
            diagnostics: None,
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
