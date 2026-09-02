use std::{
    collections::HashMap,
    ffi::OsStr,
    fs,
    path::PathBuf,
    process::Command,
    sync::{Arc, atomic::Ordering},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, State, ipc::Channel};
use tauri_plugin_dialog::DialogExt;

use crate::{
    diagnostics::{DiagnosticEventInput, DiagnosticsState},
    error::AppError,
    media::export::{
        FastExportRequest, OptimizedExportRequest, build_fast_arguments, build_optimized_arguments,
        optimized_command_preview,
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
    pub elapsed_micros: i64,
    pub frame: Option<u64>,
    pub fps: Option<String>,
    pub speed: Option<String>,
    pub bitrate: Option<String>,
    pub total_size: Option<u64>,
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

struct ExportDiagnosticContext {
    parent_operation_id: Option<String>,
    snapshot_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizedExportPlan {
    pub command_preview: String,
}

#[tauri::command]
pub async fn choose_output_path(
    app: AppHandle,
    state: State<'_, AppState>,
    default_name: String,
) -> Result<Option<OutputSelection>, AppError> {
    if default_name.trim().is_empty() || default_name.len() > 255 {
        return Err(AppError::invalid_request("The output name is required."));
    }
    let (sender, receiver) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_file_name(default_name)
        .add_filter("Video", &["mkv", "mp4", "mov", "webm"])
        .save_file(move |selected| {
            let _ = sender.send(selected);
        });
    let selected = tauri::async_runtime::spawn_blocking(move || receiver.recv())
        .await
        .map_err(|_| AppError::internal("The output dialog task stopped unexpectedly."))?
        .map_err(|_| AppError::internal("The output dialog closed unexpectedly."))?;
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
    diagnostic_parent_operation_id: Option<String>,
    diagnostic_snapshot_id: Option<String>,
    state: State<'_, AppState>,
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<ExportResult, AppError> {
    let result = async {
        let source = state.resolve_export_source(&request.source_path)?;
        let media = source
            .media
            .clone()
            .ok_or_else(|| AppError::invalid_request("Inspect the video before exporting."))?;
        let output_path = state.resolve_output(&output_id)?;
        let display_name = output_display_name(&output_path)?;
        let arguments = build_fast_arguments(&media, &request, &source.path, &output_path)?;
        run_export(
            state.clone(),
            Arc::clone(&diagnostics),
            output_path,
            display_name,
            arguments,
            on_progress,
            ExportDiagnosticContext {
                parent_operation_id: diagnostic_parent_operation_id,
                snapshot_id: diagnostic_snapshot_id,
            },
        )
        .await
    }
    .await;
    state.release_export_source(&request.source_path)?;
    result
}

#[tauri::command]
pub async fn render_optimized(
    request: OptimizedExportRequest,
    output_id: String,
    on_progress: Channel<ExportProgress>,
    diagnostic_parent_operation_id: Option<String>,
    diagnostic_snapshot_id: Option<String>,
    state: State<'_, AppState>,
    diagnostics: State<'_, Arc<DiagnosticsState>>,
) -> Result<ExportResult, AppError> {
    let result = async {
        let source = state.resolve_export_source(&request.source_path)?;
        let media = source
            .media
            .clone()
            .ok_or_else(|| AppError::invalid_request("Inspect the video before exporting."))?;
        let output_path = state.resolve_output(&output_id)?;
        let display_name = output_display_name(&output_path)?;
        let arguments = build_optimized_arguments(&media, &request, &source.path, &output_path)?;
        run_export(
            state.clone(),
            Arc::clone(&diagnostics),
            output_path,
            display_name,
            arguments,
            on_progress,
            ExportDiagnosticContext {
                parent_operation_id: diagnostic_parent_operation_id,
                snapshot_id: diagnostic_snapshot_id,
            },
        )
        .await
    }
    .await;
    state.release_export_source(&request.source_path)?;
    result
}

#[tauri::command]
pub fn plan_optimized_export(
    request: OptimizedExportRequest,
    state: State<'_, AppState>,
) -> Result<OptimizedExportPlan, AppError> {
    let source = state.resolve_source_by_path(&request.source_path)?;
    let media = source
        .media
        .as_ref()
        .ok_or_else(|| AppError::invalid_request("Inspect the video before exporting."))?;
    Ok(OptimizedExportPlan {
        command_preview: optimized_command_preview(media, &request)?,
    })
}

#[tauri::command]
pub fn cancel_operation(operation_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    state.cancel_operation(&operation_id)
}

#[tauri::command]
pub fn reserve_export_source(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.reserve_export_source(&source_path)
}

#[tauri::command]
pub fn release_export_source(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.release_export_source(&source_path)
}

#[tauri::command]
pub fn open_file_location(path: String) -> Result<(), AppError> {
    let path = PathBuf::from(path);
    if !path.is_file() && !path.is_dir() {
        return Err(AppError::io_failed(
            "The file or folder is no longer available.",
        ));
    }

    #[cfg(target_os = "windows")]
    let result = if path.is_dir() {
        Command::new("explorer.exe").arg(&path).spawn()
    } else {
        Command::new("explorer.exe")
            .arg("/select,")
            .arg(&path)
            .spawn()
    };

    #[cfg(target_os = "macos")]
    let result = if path.is_dir() {
        Command::new("open").arg(&path).spawn()
    } else {
        Command::new("open").arg("-R").arg(&path).spawn()
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open")
        .arg(if path.is_dir() {
            path.as_path()
        } else {
            path.parent().unwrap_or_else(|| std::path::Path::new("."))
        })
        .spawn();

    result
        .map(|_| ())
        .map_err(|error| AppError::io_failed(format!("Could not open the file location: {error}")))
}

async fn run_export(
    state: State<'_, AppState>,
    diagnostics: Arc<DiagnosticsState>,
    output_path: PathBuf,
    display_name: String,
    arguments: Vec<std::ffi::OsString>,
    on_progress: Channel<ExportProgress>,
    diagnostic: ExportDiagnosticContext,
) -> Result<ExportResult, AppError> {
    let ExportDiagnosticContext {
        parent_operation_id: diagnostic_parent_operation_id,
        snapshot_id: diagnostic_snapshot_id,
    } = diagnostic;
    let (operation_id, cancellation) = state.begin_operation()?;
    record_ffmpeg_event(
        &diagnostics,
        "ffmpeg.process.spawned",
        &operation_id,
        None,
        diagnostic_parent_operation_id.as_deref(),
        diagnostic_snapshot_id.as_deref(),
    );
    let _ = on_progress.send(ExportProgress {
        operation_id: operation_id.clone(),
        elapsed_micros: 0,
        frame: None,
        fps: None,
        speed: None,
        bitrate: None,
        total_size: None,
        phase: ExportPhase::Running,
    });
    let cancellation_for_check = cancellation.clone();
    let operation_for_task = operation_id.clone();
    let task_result = tauri::async_runtime::spawn_blocking(move || {
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
                        let _ = on_progress.send(ExportProgress {
                            operation_id: operation_for_task.clone(),
                            elapsed_micros,
                            frame: progress_values
                                .get("frame")
                                .and_then(|value| value.parse::<u64>().ok()),
                            fps: progress_values.get("fps").cloned(),
                            speed: progress_values.get("speed").cloned(),
                            bitrate: progress_values.get("bitrate").cloned(),
                            total_size: progress_values
                                .get("total_size")
                                .and_then(|value| value.parse::<u64>().ok()),
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
    .await;
    match &task_result {
        Ok(Ok(status)) => record_ffmpeg_event(
            &diagnostics,
            "ffmpeg.process.exited",
            &operation_id,
            Some(if status.status.success() {
                "success"
            } else {
                "failed"
            }),
            diagnostic_parent_operation_id.as_deref(),
            diagnostic_snapshot_id.as_deref(),
        ),
        Ok(Err(_)) | Err(_) => {
            record_ffmpeg_event(
                &diagnostics,
                "ffmpeg.process.exited",
                &operation_id,
                Some("failed"),
                diagnostic_parent_operation_id.as_deref(),
                diagnostic_snapshot_id.as_deref(),
            );
        }
    }
    if let Err(error) = state.finish_operation(&operation_id) {
        remove_partial_output(&output_path);
        record_ffmpeg_event(
            &diagnostics,
            "ffmpeg.export.failed",
            &operation_id,
            Some("failed"),
            diagnostic_parent_operation_id.as_deref(),
            diagnostic_snapshot_id.as_deref(),
        );
        return Err(error);
    }
    let result = match task_result {
        Ok(result) => result,
        Err(_) => {
            remove_partial_output(&output_path);
            record_ffmpeg_event(
                &diagnostics,
                "ffmpeg.export.failed",
                &operation_id,
                Some("failed"),
                diagnostic_parent_operation_id.as_deref(),
                diagnostic_snapshot_id.as_deref(),
            );
            return Err(AppError::internal(
                "The export operation stopped unexpectedly.",
            ));
        }
    };
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            remove_partial_output(&output_path);
            record_ffmpeg_event(
                &diagnostics,
                "ffmpeg.export.failed",
                &operation_id,
                Some("failed"),
                diagnostic_parent_operation_id.as_deref(),
                diagnostic_snapshot_id.as_deref(),
            );
            return Err(error);
        }
    };
    if cancellation_for_check.load(Ordering::Acquire) {
        remove_partial_output(&output_path);
        record_ffmpeg_event(
            &diagnostics,
            "ffmpeg.export.cancelled",
            &operation_id,
            Some("cancelled"),
            diagnostic_parent_operation_id.as_deref(),
            diagnostic_snapshot_id.as_deref(),
        );
        return Err(AppError::cancelled("The export was cancelled."));
    }
    if !result.status.success() {
        remove_partial_output(&output_path);
        record_ffmpeg_event(
            &diagnostics,
            "ffmpeg.export.failed",
            &operation_id,
            Some("failed"),
            diagnostic_parent_operation_id.as_deref(),
            diagnostic_snapshot_id.as_deref(),
        );
        return Err(AppError::render_failed(
            "FFmpeg could not render the selected segment.",
        ));
    }
    let output_size = match fs::metadata(&output_path) {
        Ok(metadata) => metadata.len(),
        Err(_) => {
            remove_partial_output(&output_path);
            record_ffmpeg_event(
                &diagnostics,
                "ffmpeg.export.failed",
                &operation_id,
                Some("failed"),
                diagnostic_parent_operation_id.as_deref(),
                diagnostic_snapshot_id.as_deref(),
            );
            return Err(AppError::render_failed(
                "The rendered output could not be verified.",
            ));
        }
    };
    if output_size == 0 {
        remove_partial_output(&output_path);
        record_ffmpeg_event(
            &diagnostics,
            "ffmpeg.export.failed",
            &operation_id,
            Some("failed"),
            diagnostic_parent_operation_id.as_deref(),
            diagnostic_snapshot_id.as_deref(),
        );
        return Err(AppError::render_failed("The rendered output is empty."));
    }
    record_ffmpeg_event(
        &diagnostics,
        "ffmpeg.export.completed",
        &operation_id,
        Some("success"),
        diagnostic_parent_operation_id.as_deref(),
        diagnostic_snapshot_id.as_deref(),
    );
    Ok(ExportResult {
        operation_id,
        display_name,
        display_path: output_path.display().to_string(),
    })
}

fn record_ffmpeg_event(
    diagnostics: &DiagnosticsState,
    event: &str,
    operation_id: &str,
    result: Option<&str>,
    parent_operation_id: Option<&str>,
    snapshot_id: Option<&str>,
) {
    let _ = diagnostics.record(DiagnosticEventInput {
        category: "ffmpeg".to_owned(),
        data: None,
        event: event.to_owned(),
        level: "info".to_owned(),
        operation_id: Some(operation_id.to_owned()),
        origin: None,
        parent_operation_id: parent_operation_id.map(str::to_owned),
        result: result.map(str::to_owned),
        snapshot_id: snapshot_id.map(str::to_owned),
        duration_ms: None,
    });
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
