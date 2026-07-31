use std::{
    collections::HashMap, ffi::OsStr, fs, path::PathBuf, sync::atomic::Ordering, time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, State, ipc::Channel};
use tauri_plugin_dialog::DialogExt;

use crate::{
    error::AppError,
    media::export::{
        FastExportRequest, OptimizedExportRequest, build_fast_arguments, build_optimized_arguments,
    },
    process::run_progress_cancellable,
    state::AppState,
};

const EXPORT_TIMEOUT: Duration = Duration::from_secs(24 * 60 * 60);
const EXPORT_STDOUT_LIMIT: usize = 128 * 1024;
const EXPORT_STDERR_LIMIT: usize = 256 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSelection {
    pub output_id: String,
    pub display_name: String,
    pub display_path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub operation_id: String,
    pub percentage: f64,
    pub elapsed_micros: i64,
    pub speed: Option<String>,
    pub phase: ExportPhase,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportPhase {
    Running,
    Completed,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub operation_id: String,
    pub display_name: String,
    pub display_path: String,
}

#[tauri::command]
pub fn choose_output_path(
    app: AppHandle,
    state: State<'_, AppState>,
    default_name: String,
) -> Result<Option<OutputSelection>, AppError> {
    if default_name.trim().is_empty() || default_name.len() > 255 {
        return Err(AppError::invalid_request("The output name is required."));
    }
    let selected = app
        .dialog()
        .file()
        .set_file_name(default_name)
        .add_filter("Video", &["mkv", "mp4", "mov", "webm"])
        .blocking_save_file();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|_| AppError::invalid_request("The selected output location is not supported."))?;
    let display_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::invalid_request("The output name is required."))?
        .to_owned();
    let display_path = path.display().to_string();
    let output_id = state.register_output(path)?;
    Ok(Some(OutputSelection {
        output_id,
        display_name,
        display_path,
    }))
}

#[tauri::command]
pub async fn render_fast(
    request: FastExportRequest,
    output_id: String,
    on_progress: Channel<ExportProgress>,
    state: State<'_, AppState>,
) -> Result<ExportResult, AppError> {
    let source = state.resolve_source(&request.source_id)?;
    let media = source
        .media
        .clone()
        .ok_or_else(|| AppError::invalid_request("Inspect the video before exporting."))?;
    let output_path = state.resolve_output(&output_id)?;
    let display_name = output_display_name(&output_path)?;
    let arguments = build_fast_arguments(&media, &request, &source.path, &output_path)?;
    run_export(
        state,
        request.source_id,
        output_path,
        display_name,
        arguments,
        duration_micros(&request.trim),
        on_progress,
    )
    .await
}

#[tauri::command]
pub async fn render_optimized(
    request: OptimizedExportRequest,
    output_id: String,
    on_progress: Channel<ExportProgress>,
    state: State<'_, AppState>,
) -> Result<ExportResult, AppError> {
    let source = state.resolve_source(&request.source_id)?;
    let media = source
        .media
        .clone()
        .ok_or_else(|| AppError::invalid_request("Inspect the video before exporting."))?;
    let output_path = state.resolve_output(&output_id)?;
    let display_name = output_display_name(&output_path)?;
    let arguments = build_optimized_arguments(&media, &request, &source.path, &output_path)?;
    run_export(
        state,
        request.source_id,
        output_path,
        display_name,
        arguments,
        duration_micros(&request.trim),
        on_progress,
    )
    .await
}

#[tauri::command]
pub fn cancel_operation(operation_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    state.cancel_operation(&operation_id)
}

fn duration_micros(trim: &crate::media::export::TrimSelection) -> i64 {
    trim.end_micros - trim.start_micros
}

async fn run_export(
    state: State<'_, AppState>,
    source_id: String,
    output_path: PathBuf,
    display_name: String,
    arguments: Vec<std::ffi::OsString>,
    duration_micros: i64,
    on_progress: Channel<ExportProgress>,
) -> Result<ExportResult, AppError> {
    let (operation_id, cancellation) = state.begin_operation()?;
    let cancellation_for_check = cancellation.clone();
    let operation_for_task = operation_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut progress_values = HashMap::new();
        let process = run_progress_cancellable(
            OsStr::new("ffmpeg"),
            &arguments,
            EXPORT_TIMEOUT,
            EXPORT_STDOUT_LIMIT,
            EXPORT_STDERR_LIMIT,
            || cancellation.load(Ordering::Acquire),
            |line| {
                if let Some((key, value)) = line.split_once('=') {
                    progress_values.insert(key.to_owned(), value.to_owned());
                    if key == "out_time_us" || key == "progress" {
                        let elapsed_micros = progress_values
                            .get("out_time_us")
                            .and_then(|value| value.parse::<i64>().ok())
                            .unwrap_or_default();
                        let percentage = if duration_micros > 0 {
                            (elapsed_micros as f64 / duration_micros as f64 * 100.0)
                                .clamp(0.0, 100.0)
                        } else {
                            0.0
                        };
                        let _ = on_progress.send(ExportProgress {
                            operation_id: operation_for_task.clone(),
                            percentage,
                            elapsed_micros,
                            speed: progress_values.get("speed").cloned(),
                            phase: if value == "end" {
                                ExportPhase::Completed
                            } else {
                                ExportPhase::Running
                            },
                        });
                    }
                }
            },
        );
        process.map_err(|error| {
            if error.kind() == std::io::ErrorKind::Interrupted {
                AppError::cancelled("The export was cancelled.")
            } else if error.kind() == std::io::ErrorKind::NotFound {
                AppError::io_failed("FFmpeg is required to export video files.")
            } else {
                AppError::io_failed(format!("FFmpeg could not be started: {error}"))
            }
        })
    })
    .await
    .map_err(|_| AppError::internal("The export operation stopped unexpectedly."))?;
    state.finish_operation(&operation_id)?;
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            remove_partial_output(&output_path);
            return Err(error);
        }
    };
    if cancellation_for_check.load(Ordering::Acquire) {
        remove_partial_output(&output_path);
        return Err(AppError::cancelled("The export was cancelled."));
    }
    if !result.status.success() {
        remove_partial_output(&output_path);
        return Err(AppError::io_failed(
            "FFmpeg could not render the selected segment.",
        ));
    }
    let output_size = match fs::metadata(&output_path) {
        Ok(metadata) => metadata.len(),
        Err(_) => {
            remove_partial_output(&output_path);
            return Err(AppError::io_failed(
                "The rendered output could not be verified.",
            ));
        }
    };
    if output_size == 0 {
        remove_partial_output(&output_path);
        return Err(AppError::io_failed("The rendered output is empty."));
    }
    if state.resolve_source(&source_id).is_err() {
        remove_partial_output(&output_path);
        return Err(AppError::source_replaced());
    }
    Ok(ExportResult {
        operation_id,
        display_name,
        display_path: output_path.display().to_string(),
    })
}

fn remove_partial_output(path: &std::path::Path) {
    let _ = fs::remove_file(path);
}

fn output_display_name(path: &std::path::Path) -> Result<String, AppError> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::invalid_request("The output name is required."))
}
