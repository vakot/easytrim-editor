use crate::{
    error::AppError,
    media::capabilities::{MediaCapabilities, check_media_capabilities as check_capabilities},
};

#[tauri::command]
pub async fn check_media_capabilities() -> Result<MediaCapabilities, AppError> {
    tauri::async_runtime::spawn_blocking(check_capabilities)
        .await
        .map_err(|_| AppError::internal("The media capability check stopped unexpectedly."))
}
