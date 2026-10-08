use std::{fs, path::PathBuf};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::error::{AppError, AppErrorMessageId};

const MAX_FRAME_PNG_BYTES: usize = 100 * 1024 * 1024;
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

#[tauri::command]
pub async fn save_frame_png(
    app: AppHandle,
    png_data: Vec<u8>,
    default_name: String,
) -> Result<bool, AppError> {
    validate_frame_png(&png_data)?;
    validate_default_name(&default_name)?;

    let (sender, receiver) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_file_name(default_name)
        .add_filter("PNG", &["png"])
        .save_file(move |selected| {
            let _ = sender.send(selected);
        });
    let selected = tauri::async_runtime::spawn_blocking(move || receiver.recv())
        .await
        .map_err(|_| AppError::internal("The frame save dialog stopped unexpectedly."))?
        .map_err(|_| AppError::internal("The frame save dialog closed unexpectedly."))?;

    let Some(selected) = selected else {
        return Ok(false);
    };
    let path = selected.into_path().map_err(|_| {
        AppError::invalid_request(AppErrorMessageId::FrameSelectedImageLocationIsNotSupported)
    })?;

    tauri::async_runtime::spawn_blocking(move || write_frame_png(path, png_data))
        .await
        .map_err(|_| AppError::internal("The selected frame could not be saved."))??;
    Ok(true)
}

fn validate_default_name(default_name: &str) -> Result<(), AppError> {
    if default_name.trim().is_empty()
        || default_name.chars().count() > 255
        || default_name.contains('/')
        || default_name.contains('\\')
        || default_name.chars().any(|character| {
            character.is_control() || matches!(character, ':' | '<' | '>' | '"' | '|' | '?' | '*')
        })
        || !default_name.to_ascii_lowercase().ends_with(".png")
    {
        return Err(AppError::invalid_request(
            AppErrorMessageId::FrameSuggestedFrameFilenameIsInvalid,
        ));
    }
    Ok(())
}

fn validate_frame_png(png_data: &[u8]) -> Result<(), AppError> {
    if png_data.len() < PNG_SIGNATURE.len() || !png_data.starts_with(PNG_SIGNATURE) {
        return Err(AppError::invalid_request(
            AppErrorMessageId::FrameCapturedFrameIsNotAPngImage,
        ));
    }
    if png_data.len() > MAX_FRAME_PNG_BYTES {
        return Err(AppError::invalid_request(
            AppErrorMessageId::FrameCapturedFrameIsTooLargeToSave,
        ));
    }
    Ok(())
}

fn write_frame_png(path: PathBuf, png_data: Vec<u8>) -> Result<(), AppError> {
    fs::write(path, png_data)
        .map_err(|_| AppError::io_failed(AppErrorMessageId::FrameCapturedFrameCouldNotBeSaved))
}

#[cfg(test)]
mod tests {
    use super::{MAX_FRAME_PNG_BYTES, PNG_SIGNATURE, validate_default_name, validate_frame_png};

    #[test]
    fn accepts_a_png_filename_suggestion() {
        assert!(validate_default_name("clip_42.png").is_ok());
    }

    #[test]
    fn rejects_path_components_in_the_filename_suggestion() {
        assert!(validate_default_name("../clip_42.png").is_err());
        assert!(validate_default_name("folder\\clip_42.png").is_err());
        assert!(validate_default_name("C:clip_42.png").is_err());
    }

    #[test]
    fn rejects_non_png_filename_suggestions() {
        assert!(validate_default_name("clip_42.jpg").is_err());
    }

    #[test]
    fn accepts_png_signature_and_payload() {
        let mut png_data = PNG_SIGNATURE.to_vec();
        png_data.extend_from_slice(b"image data");

        assert!(validate_frame_png(&png_data).is_ok());
    }

    #[test]
    fn rejects_non_png_payloads() {
        assert!(validate_frame_png(b"not a png").is_err());
    }

    #[test]
    fn rejects_oversized_png_payloads() {
        let mut png_data = vec![0; MAX_FRAME_PNG_BYTES + 1];
        png_data[..PNG_SIGNATURE.len()].copy_from_slice(PNG_SIGNATURE);

        assert!(validate_frame_png(&png_data).is_err());
    }
}
