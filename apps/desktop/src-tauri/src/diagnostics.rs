use std::{
    backtrace::Backtrace,
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader, BufWriter, Write},
    panic,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;

use crate::error::AppError;

const LOG_RETENTION: usize = 8;
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
const REPORT_RETENTION: usize = 10;
const UI_HEARTBEAT_MISSED_AFTER: Duration = Duration::from_secs(10);

static GLOBAL_DIAGNOSTICS: OnceLock<Arc<DiagnosticsState>> = OnceLock::new();

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticOrigin {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEventInput {
    pub category: String,
    pub data: Option<Map<String, Value>>,
    pub event: String,
    pub level: String,
    pub operation_id: Option<String>,
    pub origin: Option<DiagnosticOrigin>,
    pub parent_operation_id: Option<String>,
    pub result: Option<String>,
    pub snapshot_id: Option<String>,
    pub duration_ms: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEvent {
    category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Map<String, Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u64>,
    event: String,
    level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    operation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    origin: Option<DiagnosticOrigin>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_operation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<String>,
    session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    snapshot_id: Option<String>,
    timestamp: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionMarker {
    app_version: String,
    graceful_shutdown: bool,
    pid: u32,
    session_id: String,
    started_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatState {
    last_ui_heartbeat_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupRecovery {
    pub classification: String,
    pub report_id: String,
    pub report_path: String,
    pub session_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsBootstrap {
    pub app_version: String,
    pub recovery: Option<StartupRecovery>,
    pub session_id: String,
    pub started_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSessionSummary {
    pub app_version: Option<String>,
    pub ended_at: Option<String>,
    pub graceful_shutdown: bool,
    pub session_id: String,
    pub started_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActiveOperation {
    event: String,
    operation_id: String,
    parent_operation_id: Option<String>,
    started_at: String,
}

struct LogWriter {
    file: BufWriter<File>,
    path: PathBuf,
    segment: u8,
}

impl LogWriter {
    fn open(logs_dir: &Path, session_id: &str) -> std::io::Result<Self> {
        let path = log_path(logs_dir, session_id, 0);
        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self {
            file: BufWriter::new(file),
            path,
            segment: 0,
        })
    }

    fn write(&mut self, logs_dir: &Path, session_id: &str, line: &[u8]) -> std::io::Result<()> {
        if self.path.metadata().map_or(0, |metadata| metadata.len()) + line.len() as u64
            > MAX_LOG_BYTES
        {
            self.file.flush()?;
            self.segment = self.segment.saturating_add(1);
            self.path = log_path(logs_dir, session_id, self.segment);
            self.file = BufWriter::new(
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&self.path)?,
            );
        }
        self.file.write_all(line)?;
        self.file.write_all(b"\n")?;
        self.file.flush()
    }
}

pub struct DiagnosticsState {
    active_operations: Mutex<HashMap<String, ActiveOperation>>,
    app_version: String,
    heartbeat_path: PathBuf,
    heartbeat_persistence_degraded: AtomicBool,
    last_heartbeat: Mutex<(Instant, String, bool)>,
    logs_dir: PathBuf,
    marker_path: PathBuf,
    recovery: Option<StartupRecovery>,
    session: Mutex<SessionMarker>,
    writer: Mutex<LogWriter>,
}

impl DiagnosticsState {
    pub fn initialize(root: PathBuf, app_version: String) -> Result<Arc<Self>, AppError> {
        let logs_dir = root.join("diagnostics").join("logs");
        let reports_dir = root.join("diagnostics").join("crash-reports");
        fs::create_dir_all(&logs_dir).map_err(io_error)?;
        fs::create_dir_all(&reports_dir).map_err(io_error)?;
        let marker_path = root.join("diagnostics").join("current-session.json");
        let recovery = recover_previous_session(&marker_path, &logs_dir, &reports_dir)?;
        retain_directories(&reports_dir, REPORT_RETENTION).map_err(io_error)?;
        retain_files(&logs_dir, LOG_RETENTION).map_err(io_error)?;

        let session = SessionMarker {
            app_version: app_version.clone(),
            graceful_shutdown: false,
            pid: std::process::id(),
            session_id: Uuid::new_v4().to_string(),
            started_at: now(),
        };
        let session_started_at = session.started_at.clone();
        write_json_atomic(&marker_path, &session).map_err(io_error)?;
        let writer = LogWriter::open(&logs_dir, &session.session_id).map_err(io_error)?;
        let state = Arc::new(Self {
            active_operations: Mutex::new(HashMap::new()),
            app_version,
            heartbeat_path: logs_dir.join(format!("session-{}.heartbeat.json", session.session_id)),
            heartbeat_persistence_degraded: AtomicBool::new(false),
            last_heartbeat: Mutex::new((Instant::now(), now(), false)),
            logs_dir,
            marker_path,
            recovery,
            session: Mutex::new(session),
            writer: Mutex::new(writer),
        });
        state.record(DiagnosticEventInput {
            category: "app".to_owned(),
            data: Some(Map::from_iter([
                (
                    "appVersion".to_owned(),
                    Value::String(state.app_version.clone()),
                ),
                ("pid".to_owned(), Value::from(std::process::id())),
                ("startedAt".to_owned(), Value::String(session_started_at)),
            ])),
            duration_ms: None,
            event: "app.session.started".to_owned(),
            level: "info".to_owned(),
            operation_id: None,
            origin: Some(DiagnosticOrigin {
                id: None,
                kind: "system".to_owned(),
            }),
            parent_operation_id: None,
            result: Some("started".to_owned()),
            snapshot_id: None,
        })?;
        let _ = GLOBAL_DIAGNOSTICS.set(Arc::clone(&state));
        Ok(state)
    }

    pub fn bootstrap(&self) -> Result<DiagnosticsBootstrap, AppError> {
        let session = self
            .session
            .lock()
            .map_err(|_| AppError::internal("Diagnostics session state is unavailable."))?;
        Ok(DiagnosticsBootstrap {
            app_version: self.app_version.clone(),
            recovery: self.recovery.clone(),
            session_id: session.session_id.clone(),
            started_at: session.started_at.clone(),
        })
    }

    pub fn list_persisted_sessions(&self) -> Result<Vec<DiagnosticSessionSummary>, AppError> {
        let current_session_id = self.current_session_id()?;
        let sessions = discover_session_logs(&self.logs_dir).map_err(io_error)?;
        let mut summaries = sessions
            .into_iter()
            .filter(|(session_id, _)| session_id != &current_session_id)
            .filter_map(|(session_id, paths)| {
                session_summary(&session_id, &read_events_from_paths(&paths, &session_id))
            })
            .collect::<Vec<_>>();
        summaries.sort_by(|left, right| right.started_at.cmp(&left.started_at));
        Ok(summaries)
    }

    pub fn read_persisted_session_events(
        &self,
        session_id: &str,
    ) -> Result<Vec<DiagnosticEvent>, AppError> {
        if !valid_session_id(session_id) {
            return Err(AppError::invalid_request(
                "The diagnostic session identifier is invalid.",
            ));
        }
        if session_id == self.current_session_id()? {
            return Ok(Vec::new());
        }
        let mut sessions = discover_session_logs(&self.logs_dir).map_err(io_error)?;
        Ok(sessions
            .remove(session_id)
            .map_or_else(Vec::new, |paths| read_events_from_paths(&paths, session_id)))
    }

    fn current_session_id(&self) -> Result<String, AppError> {
        self.session
            .lock()
            .map_err(|_| AppError::internal("Diagnostics session state is unavailable."))
            .map(|session| session.session_id.clone())
    }

    pub fn record(&self, input: DiagnosticEventInput) -> Result<(), AppError> {
        validate_event(&input)?;
        let session_id = self
            .session
            .lock()
            .map_err(|_| AppError::internal("Diagnostics session state is unavailable."))?
            .session_id
            .clone();
        let event = DiagnosticEvent {
            category: input.category,
            data: input.data.map(sanitize_map),
            duration_ms: input.duration_ms,
            event: input.event,
            level: input.level,
            operation_id: input.operation_id,
            origin: input.origin,
            parent_operation_id: input.parent_operation_id,
            result: input.result,
            session_id: session_id.clone(),
            snapshot_id: input.snapshot_id,
            timestamp: now(),
        };
        self.update_operations(&event)?;
        let line = serde_json::to_vec(&event)
            .map_err(|_| AppError::internal("A diagnostic event could not be serialized."))?;
        self.writer
            .lock()
            .map_err(|_| AppError::internal("The diagnostics writer is unavailable."))?
            .write(&self.logs_dir, &session_id, &line)
            .map_err(io_error)
    }

    pub fn heartbeat(&self) -> Result<(), AppError> {
        let mut heartbeat = self
            .last_heartbeat
            .lock()
            .map_err(|_| AppError::internal("UI heartbeat state is unavailable."))?;
        let elapsed = heartbeat.0.elapsed();
        heartbeat.0 = Instant::now();
        heartbeat.1 = now();
        let heartbeat_timestamp = heartbeat.1.clone();
        self.persist_heartbeat(HeartbeatState {
            last_ui_heartbeat_at: heartbeat_timestamp,
        });
        if elapsed >= UI_HEARTBEAT_MISSED_AFTER {
            heartbeat.2 = false;
            drop(heartbeat);
            self.record(DiagnosticEventInput {
                category: "ui".to_owned(),
                data: Some(Map::from_iter([(
                    "elapsedMs".to_owned(),
                    Value::from(elapsed.as_millis() as u64),
                )])),
                duration_ms: None,
                event: "ui.heartbeat.recovered".to_owned(),
                level: "warn".to_owned(),
                operation_id: None,
                origin: Some(DiagnosticOrigin {
                    id: None,
                    kind: "system".to_owned(),
                }),
                parent_operation_id: None,
                result: None,
                snapshot_id: None,
            })?;
        }
        Ok(())
    }

    fn persist_heartbeat(&self, heartbeat: HeartbeatState) {
        match write_json_atomic(&self.heartbeat_path, &heartbeat) {
            Ok(()) => {
                self.heartbeat_persistence_degraded
                    .store(false, Ordering::Release);
            }
            Err(error) => {
                if !self
                    .heartbeat_persistence_degraded
                    .swap(true, Ordering::AcqRel)
                {
                    eprintln!("[diagnostics] UI heartbeat persistence unavailable: {error}");
                }
            }
        }
    }

    pub fn check_heartbeat(&self) {
        let missed = self.last_heartbeat.lock().ok().and_then(|mut heartbeat| {
            let elapsed = heartbeat.0.elapsed();
            if elapsed >= UI_HEARTBEAT_MISSED_AFTER && !heartbeat.2 {
                heartbeat.2 = true;
                Some(elapsed)
            } else {
                None
            }
        });
        if let Some(elapsed) = missed {
            let _ = self.record(DiagnosticEventInput {
                category: "ui".to_owned(),
                data: Some(Map::from_iter([(
                    "elapsedMs".to_owned(),
                    Value::from(elapsed.as_millis() as u64),
                )])),
                duration_ms: None,
                event: "ui.heartbeat.missed".to_owned(),
                level: "warn".to_owned(),
                operation_id: None,
                origin: Some(DiagnosticOrigin {
                    id: None,
                    kind: "system".to_owned(),
                }),
                parent_operation_id: None,
                result: None,
                snapshot_id: None,
            });
        }
    }

    pub fn complete(&self) -> Result<(), AppError> {
        let already_complete = self
            .session
            .lock()
            .map_err(|_| AppError::internal("Diagnostics session state is unavailable."))?
            .graceful_shutdown;
        if already_complete {
            return Ok(());
        }
        self.record(DiagnosticEventInput {
            category: "app".to_owned(),
            data: None,
            duration_ms: None,
            event: "app.session.completed".to_owned(),
            level: "info".to_owned(),
            operation_id: None,
            origin: Some(DiagnosticOrigin {
                id: None,
                kind: "system".to_owned(),
            }),
            parent_operation_id: None,
            result: Some("success".to_owned()),
            snapshot_id: None,
        })?;
        let marker = {
            let mut session = self
                .session
                .lock()
                .map_err(|_| AppError::internal("Diagnostics session state is unavailable."))?;
            session.graceful_shutdown = true;
            session.clone()
        };
        write_json_atomic(&self.marker_path, &marker).map_err(io_error)
    }

    pub fn reveal_report(&self, report_id: &str) -> Result<(), AppError> {
        let recovery = self
            .recovery
            .as_ref()
            .filter(|recovery| recovery.report_id == report_id)
            .ok_or_else(|| AppError::invalid_request("The diagnostic report is unavailable."))?;
        reveal_file(Path::new(&recovery.report_path))
    }

    fn update_operations(&self, event: &DiagnosticEvent) -> Result<(), AppError> {
        let Some(operation_id) = event.operation_id.as_ref() else {
            return Ok(());
        };
        let mut operations = self
            .active_operations
            .lock()
            .map_err(|_| AppError::internal("The diagnostic operation registry is unavailable."))?;
        match event.result.as_deref() {
            Some("started") => {
                operations.insert(
                    operation_id.clone(),
                    ActiveOperation {
                        event: event.event.trim_end_matches(".started").to_owned(),
                        operation_id: operation_id.clone(),
                        parent_operation_id: event.parent_operation_id.clone(),
                        started_at: event.timestamp.clone(),
                    },
                );
            }
            Some("success" | "cancelled" | "failed" | "ignored" | "rejected") => {
                operations.remove(operation_id);
            }
            _ => {}
        }
        Ok(())
    }
}

pub fn install_panic_hook() {
    let previous = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        if let Some(diagnostics) = GLOBAL_DIAGNOSTICS.get() {
            let message = info
                .payload()
                .downcast_ref::<&str>()
                .map(|message| (*message).to_owned())
                .or_else(|| info.payload().downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "Non-string panic payload".to_owned());
            let mut data = Map::new();
            data.insert("message".to_owned(), Value::String(message));
            data.insert(
                "thread".to_owned(),
                Value::String(
                    std::thread::current()
                        .name()
                        .unwrap_or("unnamed")
                        .to_owned(),
                ),
            );
            data.insert(
                "backtrace".to_owned(),
                Value::String(Backtrace::force_capture().to_string()),
            );
            if let Some(location) = info.location() {
                data.insert(
                    "location".to_owned(),
                    Value::String(format!(
                        "{}:{}:{}",
                        location.file(),
                        location.line(),
                        location.column()
                    )),
                );
            }
            let _ = diagnostics.record(DiagnosticEventInput {
                category: "native".to_owned(),
                data: Some(data),
                duration_ms: None,
                event: "native.panic.captured".to_owned(),
                level: "fatal".to_owned(),
                operation_id: None,
                origin: Some(DiagnosticOrigin {
                    id: None,
                    kind: "system".to_owned(),
                }),
                parent_operation_id: None,
                result: Some("failed".to_owned()),
                snapshot_id: None,
            });
        }
        previous(info);
    }));
}

pub fn complete_global_session() {
    if let Some(diagnostics) = GLOBAL_DIAGNOSTICS.get() {
        let _ = diagnostics.complete();
    }
}

fn validate_event(input: &DiagnosticEventInput) -> Result<(), AppError> {
    if !valid_event_name(&input.event) || !valid_event_name(&input.category) {
        return Err(AppError::invalid_request(
            "The diagnostic event name is invalid.",
        ));
    }
    if !matches!(
        input.level.as_str(),
        "trace" | "debug" | "info" | "warn" | "error" | "fatal"
    ) {
        return Err(AppError::invalid_request(
            "The diagnostic level is invalid.",
        ));
    }
    Ok(())
}

fn valid_event_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 96
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || byte == b'.'
                || byte == b'-'
                || byte == b'_'
        })
}

fn sanitize_map(data: Map<String, Value>) -> Map<String, Value> {
    data.into_iter()
        .filter(|(key, _)| !is_sensitive_key(key))
        .take(32)
        .map(|(key, value)| (key, sanitize_value(value, 0)))
        .collect()
}

fn sanitize_value(value: Value, depth: u8) -> Value {
    if depth >= 3 {
        return Value::String("[truncated]".to_owned());
    }
    match value {
        Value::String(value) => Value::String(value.chars().take(2_048).collect()),
        Value::Array(values) => Value::Array(
            values
                .into_iter()
                .take(32)
                .map(|value| sanitize_value(value, depth + 1))
                .collect(),
        ),
        Value::Object(values) => Value::Object(
            values
                .into_iter()
                .take(32)
                .filter(|(key, _)| !is_sensitive_key(key))
                .map(|(key, value)| (key, sanitize_value(value, depth + 1)))
                .collect(),
        ),
        value => value,
    }
}

fn is_sensitive_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    ["token", "password", "secret", "credential", "authorization"]
        .iter()
        .any(|sensitive| key.contains(sensitive))
}

fn recover_previous_session(
    marker_path: &Path,
    logs_dir: &Path,
    reports_dir: &Path,
) -> Result<Option<StartupRecovery>, AppError> {
    if !marker_path.exists() {
        return Ok(None);
    }
    let marker = fs::read(marker_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<SessionMarker>(&bytes).ok());
    match marker {
        Some(marker) if marker.graceful_shutdown => Ok(None),
        Some(marker) => create_report(&marker, logs_dir, reports_dir).map(Some),
        None => {
            let marker = SessionMarker {
                app_version: "unknown".to_owned(),
                graceful_shutdown: false,
                pid: 0,
                session_id: format!("unknown-{}", Uuid::new_v4()),
                started_at: "unknown".to_owned(),
            };
            create_report(&marker, logs_dir, reports_dir).map(Some)
        }
    }
}

fn create_report(
    marker: &SessionMarker,
    logs_dir: &Path,
    reports_dir: &Path,
) -> Result<StartupRecovery, AppError> {
    let events = read_session_events(logs_dir, &marker.session_id);
    let classification = if events
        .iter()
        .any(|event| event.event == "native.panic.captured")
    {
        "native_panic"
    } else if events
        .iter()
        .any(|event| event.event.starts_with("frontend.fatal"))
    {
        "frontend_fatal_error"
    } else {
        "abnormal_shutdown"
    };
    let mut unfinished = HashMap::<String, ActiveOperation>::new();
    for event in &events {
        let Some(operation_id) = event.operation_id.as_ref() else {
            continue;
        };
        match event.result.as_deref() {
            Some("started") => {
                unfinished.insert(
                    operation_id.clone(),
                    ActiveOperation {
                        event: event.event.trim_end_matches(".started").to_owned(),
                        operation_id: operation_id.clone(),
                        parent_operation_id: event.parent_operation_id.clone(),
                        started_at: event.timestamp.clone(),
                    },
                );
            }
            Some("success" | "cancelled" | "failed" | "ignored" | "rejected") => {
                unfinished.remove(operation_id);
            }
            _ => {}
        }
    }
    let report_id = format!("{}_{}", filename_timestamp(), marker.session_id);
    let report_dir = reports_dir.join(&report_id);
    fs::create_dir_all(&report_dir).map_err(io_error)?;
    let report_path = report_dir.join("report.log");
    let last_event = events.last();
    let last_heartbeat_event = events
        .iter()
        .rev()
        .find(|event| event.event.starts_with("ui.heartbeat"));
    let last_ui_heartbeat_at =
        fs::read(logs_dir.join(format!("session-{}.heartbeat.json", marker.session_id)))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<HeartbeatState>(&bytes).ok())
            .map(|heartbeat| heartbeat.last_ui_heartbeat_at);
    let metadata = json!({
        "appVersion": marker.app_version,
        "classification": classification,
        "lastEvent": last_event,
        "lastRecordedEventAt": last_event.map(|event| &event.timestamp),
        "lastHeartbeatEvent": last_heartbeat_event,
        "lastUiHeartbeatAt": &last_ui_heartbeat_at,
        "platform": std::env::consts::OS,
        "pid": marker.pid,
        "sessionId": marker.session_id,
        "sessionStartedAt": marker.started_at,
        "unfinishedOperations": unfinished.values().collect::<Vec<_>>(),
    });
    write_json_atomic(&report_dir.join("report.json"), &metadata).map_err(io_error)?;
    write_json_atomic(&report_dir.join("session.json"), marker).map_err(io_error)?;
    let mut human = BufWriter::new(File::create(&report_path).map_err(io_error)?);
    writeln!(human, "EasyTrim diagnostic report").map_err(io_error)?;
    writeln!(human, "Classification: {classification}").map_err(io_error)?;
    writeln!(human, "Session: {}", marker.session_id).map_err(io_error)?;
    writeln!(human, "App version: {}", marker.app_version).map_err(io_error)?;
    writeln!(human, "Started: {}", marker.started_at).map_err(io_error)?;
    writeln!(
        human,
        "Last UI heartbeat: {}",
        last_ui_heartbeat_at.as_deref().unwrap_or("none")
    )
    .map_err(io_error)?;
    writeln!(
        human,
        "Last event: {}",
        last_event.map_or("none", |event| event.event.as_str())
    )
    .map_err(io_error)?;
    writeln!(human, "\nUnfinished operations:").map_err(io_error)?;
    for operation in unfinished.values() {
        writeln!(
            human,
            "- {} ({}) started {}",
            operation.event, operation.operation_id, operation.started_at
        )
        .map_err(io_error)?;
    }
    writeln!(human, "\nEvent timeline:").map_err(io_error)?;
    for event in &events {
        write_human_event(&mut human, event).map_err(io_error)?;
    }
    human.flush().map_err(io_error)?;
    Ok(StartupRecovery {
        classification: classification.to_owned(),
        report_id,
        report_path: report_path.to_string_lossy().into_owned(),
        session_id: marker.session_id.clone(),
    })
}

fn write_human_event(writer: &mut impl Write, event: &DiagnosticEvent) -> std::io::Result<()> {
    writeln!(
        writer,
        "{} {:<5} {}",
        event.timestamp,
        event.level.to_uppercase(),
        event.event
    )?;
    if let Some(origin) = &event.origin {
        writeln!(
            writer,
            "  origin={}{}",
            origin.kind,
            origin
                .id
                .as_deref()
                .map_or_else(String::new, |id| format!(":{id}"))
        )?;
    }
    if let Some(snapshot_id) = &event.snapshot_id {
        writeln!(writer, "  snapshot={snapshot_id}")?;
    }
    if let Some(operation_id) = &event.operation_id {
        writeln!(writer, "  operation={operation_id}")?;
    }
    if let Some(parent_operation_id) = &event.parent_operation_id {
        writeln!(writer, "  parent={parent_operation_id}")?;
    }
    if let Some(result) = &event.result {
        writeln!(writer, "  result={result}")?;
    }
    if let Some(duration_ms) = event.duration_ms {
        writeln!(writer, "  duration={duration_ms}ms")?;
    }
    if let Some(data) = &event.data {
        writeln!(writer, "  data={}", Value::Object(data.clone()))?;
    }
    writeln!(writer)
}

fn read_session_events(logs_dir: &Path, session_id: &str) -> Vec<DiagnosticEvent> {
    discover_session_logs(logs_dir)
        .ok()
        .and_then(|mut sessions| sessions.remove(session_id))
        .map_or_else(Vec::new, |paths| read_events_from_paths(&paths, session_id))
}

fn discover_session_logs(logs_dir: &Path) -> std::io::Result<HashMap<String, Vec<PathBuf>>> {
    let mut sessions = HashMap::<String, Vec<PathBuf>>::new();
    for entry in fs::read_dir(logs_dir)?.flatten() {
        if !entry.file_type().is_ok_and(|kind| kind.is_file()) {
            continue;
        }
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let Some(session_id) = parse_session_log_name(&name) else {
            continue;
        };
        sessions
            .entry(session_id.to_owned())
            .or_default()
            .push(entry.path());
    }
    for paths in sessions.values_mut() {
        paths.sort();
    }
    Ok(sessions)
}

fn parse_session_log_name(name: &str) -> Option<&str> {
    let name = name.strip_prefix("session-")?.strip_suffix(".jsonl")?;
    let (session_id, segment) = name.rsplit_once('.')?;
    (segment.len() == 3
        && segment.bytes().all(|byte| byte.is_ascii_digit())
        && valid_session_id(session_id))
    .then_some(session_id)
}

fn valid_session_id(session_id: &str) -> bool {
    !session_id.is_empty()
        && session_id.len() <= 128
        && session_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn read_events_from_paths(paths: &[PathBuf], session_id: &str) -> Vec<DiagnosticEvent> {
    paths
        .iter()
        .flat_map(|path| read_events_from_path(path, session_id))
        .collect()
}

fn read_events_from_path(path: &Path, session_id: &str) -> Vec<DiagnosticEvent> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let mut reader = BufReader::new(file);
    let mut events = Vec::new();
    let mut line = Vec::new();
    loop {
        line.clear();
        match reader.read_until(b'\n', &mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                while matches!(line.last(), Some(b'\n' | b'\r')) {
                    line.pop();
                }
                if line.is_empty() {
                    continue;
                }
                let Ok(event) = serde_json::from_slice::<DiagnosticEvent>(&line) else {
                    continue;
                };
                if let Some(event) = normalize_persisted_event(event, session_id) {
                    events.push(event);
                }
            }
        }
    }
    events
}

fn normalize_persisted_event(
    mut event: DiagnosticEvent,
    expected_session_id: &str,
) -> Option<DiagnosticEvent> {
    if event.session_id != expected_session_id
        || !valid_session_id(&event.session_id)
        || !valid_event_name(&event.event)
        || !valid_event_name(&event.category)
        || !matches!(
            event.level.as_str(),
            "trace" | "debug" | "info" | "warn" | "error" | "fatal"
        )
        || OffsetDateTime::parse(&event.timestamp, &Rfc3339).is_err()
    {
        return None;
    }
    if event.result.as_deref().is_some_and(|result| {
        !matches!(
            result,
            "started" | "success" | "cancelled" | "failed" | "ignored" | "rejected"
        )
    }) {
        event.result = None;
    }
    if event.origin.as_ref().is_some_and(|origin| {
        !matches!(
            origin.kind.as_str(),
            "button" | "hotkey" | "menu" | "timeline" | "system" | "restore" | "internal"
        )
    }) {
        event.origin = None;
    }
    event.data = event.data.map(sanitize_map);
    Some(event)
}

fn session_summary(
    session_id: &str,
    events: &[DiagnosticEvent],
) -> Option<DiagnosticSessionSummary> {
    let started_event = events
        .iter()
        .find(|event| event.event == "app.session.started")?;
    let started_at = started_event
        .data
        .as_ref()
        .and_then(|data| data.get("startedAt"))
        .and_then(Value::as_str)
        .filter(|timestamp| OffsetDateTime::parse(timestamp, &Rfc3339).is_ok())
        .unwrap_or(&started_event.timestamp)
        .to_owned();
    let app_version = started_event
        .data
        .as_ref()
        .and_then(|data| data.get("appVersion"))
        .and_then(Value::as_str)
        .filter(|version| !version.is_empty())
        .map(str::to_owned);
    let ended_at = events
        .iter()
        .rev()
        .find(|event| {
            event.event == "app.session.completed" && event.result.as_deref() == Some("success")
        })
        .map(|event| event.timestamp.clone());
    Some(DiagnosticSessionSummary {
        app_version,
        graceful_shutdown: ended_at.is_some(),
        ended_at,
        session_id: session_id.to_owned(),
        started_at,
    })
}

fn retain_directories(parent: &Path, keep: usize) -> std::io::Result<()> {
    let mut entries = fs::read_dir(parent)?
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    let remove_count = entries.len().saturating_sub(keep);
    for entry in entries.into_iter().take(remove_count) {
        fs::remove_dir_all(entry.path())?;
    }
    Ok(())
}

fn retain_files(parent: &Path, keep_sessions: usize) -> std::io::Result<()> {
    let mut sessions = HashMap::<String, Vec<PathBuf>>::new();
    for entry in fs::read_dir(parent)?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(session) = name
            .strip_prefix("session-")
            .and_then(|name| name.split('.').next())
        {
            sessions
                .entry(session.to_owned())
                .or_default()
                .push(entry.path());
        }
    }
    let mut names = sessions
        .iter()
        .map(|(name, paths)| {
            let modified = paths
                .iter()
                .filter_map(|path| path.metadata().ok()?.modified().ok())
                .max();
            (name.clone(), modified)
        })
        .collect::<Vec<_>>();
    names.sort_by_key(|(_, modified)| *modified);
    let remove_count = names.len().saturating_sub(keep_sessions);
    for (name, _) in names.into_iter().take(remove_count) {
        for path in sessions.remove(&name).unwrap_or_default() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> std::io::Result<()> {
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

fn log_path(logs_dir: &Path, session_id: &str, segment: u8) -> PathBuf {
    logs_dir.join(format!("session-{session_id}.{segment:03}.jsonl"))
}

fn now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "unknown".to_owned())
}

fn filename_timestamp() -> String {
    now().replace([':', '.'], "-")
}

fn io_error(error: std::io::Error) -> AppError {
    AppError::internal(format!("Diagnostics storage failed: {error}"))
}

#[cfg(target_os = "windows")]
fn reveal_file(path: &Path) -> Result<(), AppError> {
    let (program, arguments) = reveal_command(path)?;
    Command::new(program)
        .args(arguments)
        .spawn()
        .map(|_| ())
        .map_err(io_error)
}

#[cfg(target_os = "windows")]
fn reveal_command(path: &Path) -> Result<(&'static str, Vec<String>), AppError> {
    if !path.is_absolute() {
        return Err(AppError::invalid_request(
            "The diagnostic report path is invalid.",
        ));
    }
    Ok(("explorer.exe", vec![format!("/select,{}", path.display())]))
}

#[cfg(target_os = "macos")]
fn reveal_file(path: &Path) -> Result<(), AppError> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(io_error)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn reveal_file(path: &Path) -> Result<(), AppError> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::invalid_request("The diagnostic report path is invalid."))?;
    Command::new("xdg-open")
        .arg(parent)
        .spawn()
        .map(|_| ())
        .map_err(io_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "easytrim-diagnostics-test-{name}-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("temporary root created");
        root
    }

    fn persisted_event(session_id: &str, event: &str, timestamp: &str) -> DiagnosticEvent {
        DiagnosticEvent {
            category: event.split('.').next().unwrap_or("test").to_owned(),
            data: None,
            duration_ms: None,
            event: event.to_owned(),
            level: "info".to_owned(),
            operation_id: Some("operation-1".to_owned()),
            origin: None,
            parent_operation_id: None,
            result: Some("success".to_owned()),
            session_id: session_id.to_owned(),
            snapshot_id: None,
            timestamp: timestamp.to_owned(),
        }
    }

    #[test]
    fn creates_and_completes_a_session() {
        let root = temporary_root("session");
        let state =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("session starts");
        let bootstrap = state.bootstrap().expect("bootstrap available");
        assert!(!bootstrap.session_id.is_empty());
        state.complete().expect("session completes");
        let marker: SessionMarker = serde_json::from_slice(
            &fs::read(root.join("diagnostics/current-session.json")).expect("marker read"),
        )
        .expect("marker valid");
        assert!(marker.graceful_shutdown);
        drop(state);
        let next = DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned())
            .expect("next session starts");
        assert!(next.bootstrap().expect("next bootstrap").recovery.is_none());
        next.complete().expect("next session completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn lists_and_reads_retained_sessions_without_the_active_session() {
        let root = temporary_root("history");
        let first =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("first starts");
        let first_bootstrap = first.bootstrap().expect("first bootstrap");
        let first_id = first_bootstrap.session_id.clone();
        first
            .record(DiagnosticEventInput {
                category: "ffmpeg".to_owned(),
                data: Some(Map::from_iter([
                    (
                        "outputPath".to_owned(),
                        Value::String("C:/Exports/clip.mp4".to_owned()),
                    ),
                    ("outputType".to_owned(), Value::String("fast".to_owned())),
                ])),
                duration_ms: Some(10),
                event: "ffmpeg.export.completed".to_owned(),
                level: "info".to_owned(),
                operation_id: Some("export-1".to_owned()),
                origin: None,
                parent_operation_id: None,
                result: Some("success".to_owned()),
                snapshot_id: None,
            })
            .expect("activity persisted");
        first.complete().expect("first completes");
        drop(first);

        let second =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("second starts");
        let second_id = second.bootstrap().expect("second bootstrap").session_id;
        let sessions = second.list_persisted_sessions().expect("history listed");

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, first_id);
        assert_eq!(sessions[0].app_version.as_deref(), Some("1.0.0"));
        assert_eq!(sessions[0].started_at, first_bootstrap.started_at);
        assert!(sessions[0].graceful_shutdown);
        assert!(sessions[0].ended_at.is_some());
        let events = second
            .read_persisted_session_events(&first_id)
            .expect("history read");
        assert!(events.iter().all(|event| event.session_id == first_id));
        assert!(
            events
                .iter()
                .any(|event| event.event == "ffmpeg.export.completed")
        );
        assert!(
            second
                .read_persisted_session_events(&second_id)
                .expect("active session ignored")
                .is_empty()
        );

        second.complete().expect("second completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn persisted_reader_skips_malformed_invalid_and_partial_lines() {
        let root = temporary_root("history-lines");
        let logs = root.join("logs");
        fs::create_dir_all(&logs).expect("logs created");
        let session_id = "retained-session";
        let valid = persisted_event(
            session_id,
            "ffmpeg.export.completed",
            "2026-08-31T09:00:00Z",
        );
        let wrong_session = persisted_event(
            "different-session",
            "ffmpeg.export.completed",
            "2026-08-31T09:01:00Z",
        );
        let segment = format!(
            "{}\nnot json\n{}\n{{\"category\":\"ffmpeg\"",
            serde_json::to_string(&valid).expect("valid event serialized"),
            serde_json::to_string(&wrong_session).expect("invalid event serialized")
        );
        fs::write(log_path(&logs, session_id, 0), segment).expect("segment written");
        fs::write(
            log_path(&logs, session_id, 1),
            serde_json::to_vec(&persisted_event(
                session_id,
                "source.file-restore.completed",
                "2026-08-31T09:02:00Z",
            ))
            .expect("final event serialized"),
        )
        .expect("final segment written");

        let events = read_session_events(&logs, session_id);

        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event, "ffmpeg.export.completed");
        assert_eq!(events[1].event, "source.file-restore.completed");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn retained_session_metadata_keeps_an_unknown_legacy_version() {
        let started = persisted_event(
            "legacy-session",
            "app.session.started",
            "2026-08-30T09:00:00Z",
        );

        let summary = session_summary("legacy-session", &[started]).expect("summary available");

        assert_eq!(summary.app_version, None);
        assert_eq!(summary.started_at, "2026-08-30T09:00:00Z");
    }

    #[test]
    fn persisted_history_rejects_traversal_and_tolerates_missing_sessions() {
        let root = temporary_root("history-validation");
        let state =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("session starts");

        let error = state
            .read_persisted_session_events("../outside")
            .expect_err("traversal rejected");
        assert_eq!(error.code, "invalid_request");
        assert!(
            state
                .read_persisted_session_events("missing-session")
                .expect("missing session tolerated")
                .is_empty()
        );

        state.complete().expect("session completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn reports_an_unclosed_session_and_unfinished_operation() {
        let root = temporary_root("recovery");
        let first =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("first starts");
        first
            .record(DiagnosticEventInput {
                category: "preview".to_owned(),
                data: Some(Map::from_iter([(
                    "previewKind".to_owned(),
                    Value::String("proxy".to_owned()),
                )])),
                duration_ms: None,
                event: "preview.prepare.started".to_owned(),
                level: "info".to_owned(),
                operation_id: Some("preview-1".to_owned()),
                origin: Some(DiagnosticOrigin {
                    id: Some("snapshot.card".to_owned()),
                    kind: "button".to_owned(),
                }),
                parent_operation_id: Some("source-1".to_owned()),
                result: Some("started".to_owned()),
                snapshot_id: Some("8".to_owned()),
            })
            .expect("operation persisted");
        first
            .record(DiagnosticEventInput {
                category: "audio".to_owned(),
                data: None,
                duration_ms: Some(126),
                event: "audio.source-switch.completed".to_owned(),
                level: "info".to_owned(),
                operation_id: Some("audio-switch-55".to_owned()),
                origin: None,
                parent_operation_id: Some("preview-1".to_owned()),
                result: Some("success".to_owned()),
                snapshot_id: None,
            })
            .expect("completed operation persisted");
        drop(first);
        let second =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("second starts");
        let recovery = second
            .bootstrap()
            .expect("bootstrap")
            .recovery
            .expect("recovery created");
        assert_eq!(recovery.classification, "abnormal_shutdown");
        let report = fs::read_to_string(recovery.report_path).expect("report read");
        assert!(report.contains("preview.prepare"));
        assert!(report.contains("  origin=button:snapshot.card"));
        assert!(report.contains("  snapshot=8"));
        assert!(report.contains("  operation=preview-1"));
        assert!(report.contains("  parent=source-1"));
        assert!(report.contains("  result=started"));
        assert!(report.contains("  duration=126ms"));
        assert!(report.contains("  data={\"previewKind\":\"proxy\"}"));
        second.complete().expect("second completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn corrupt_marker_is_reported_without_blocking_startup() {
        let root = temporary_root("corrupt");
        fs::create_dir_all(root.join("diagnostics")).expect("diagnostics created");
        fs::write(root.join("diagnostics/current-session.json"), b"not json")
            .expect("corrupt marker written");
        let state = DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned())
            .expect("startup recovers");
        assert!(state.bootstrap().expect("bootstrap").recovery.is_some());
        state.complete().expect("session completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn frontend_fatal_error_classifies_the_recovered_session() {
        let root = temporary_root("frontend-fatal");
        let first =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("first starts");
        first
            .record(DiagnosticEventInput {
                category: "frontend".to_owned(),
                data: None,
                duration_ms: None,
                event: "frontend.fatal.error".to_owned(),
                level: "fatal".to_owned(),
                operation_id: None,
                origin: None,
                parent_operation_id: None,
                result: Some("failed".to_owned()),
                snapshot_id: None,
            })
            .expect("fatal event persisted");
        drop(first);
        let second =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("second starts");
        assert_eq!(
            second
                .bootstrap()
                .expect("bootstrap")
                .recovery
                .expect("recovery")
                .classification,
            "frontend_fatal_error"
        );
        second.complete().expect("session completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_reveal_command_selects_the_report_file() {
        let (program, arguments) =
            reveal_command(Path::new(r"C:\diagnostics\report.log")).expect("command constructed");
        assert_eq!(program, "explorer.exe");
        assert_eq!(arguments, vec![r"/select,C:\diagnostics\report.log"]);
    }

    #[test]
    fn rotates_large_logs_and_retains_recent_reports() {
        let root = temporary_root("retention");
        let logs = root.join("logs");
        let reports = root.join("reports");
        fs::create_dir_all(&logs).expect("logs created");
        fs::create_dir_all(&reports).expect("reports created");
        let mut writer = LogWriter::open(&logs, "session").expect("writer opens");
        writer
            .write(&logs, "session", &vec![b'x'; MAX_LOG_BYTES as usize])
            .expect("first segment written");
        writer
            .write(&logs, "session", b"next")
            .expect("next segment written");
        assert!(log_path(&logs, "session", 1).exists());

        for index in 0..12 {
            fs::create_dir(reports.join(format!("{index:02}-report")))
                .expect("report directory created");
        }
        retain_directories(&reports, REPORT_RETENTION).expect("reports retained");
        assert_eq!(
            fs::read_dir(&reports).expect("reports read").count(),
            REPORT_RETENTION
        );
        assert!(!reports.join("00-report").exists());
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn removes_sensitive_keys_at_every_object_level() {
        let sensitive_keys = [
            "token",
            "accessToken",
            "password",
            "secret",
            "credential",
            "authorization",
        ];
        let mut nested = Map::new();
        let mut data = Map::new();
        for key in sensitive_keys {
            data.insert(key.to_owned(), Value::String("top-secret".to_owned()));
            nested.insert(key.to_owned(), Value::String("nested-secret".to_owned()));
        }
        data.insert("safe".to_owned(), Value::String("visible".to_owned()));
        nested.insert("safe".to_owned(), Value::String("visible".to_owned()));
        data.insert("nested".to_owned(), Value::Object(nested));

        let sanitized = sanitize_map(data);
        for key in sensitive_keys {
            assert!(!sanitized.contains_key(key));
            assert!(
                !sanitized["nested"]
                    .as_object()
                    .expect("nested object")
                    .contains_key(key)
            );
        }
        assert_eq!(sanitized["safe"], "visible");
        assert_eq!(sanitized["nested"]["safe"], "visible");
    }

    #[test]
    fn repeated_atomic_writes_replace_existing_heartbeat_state() {
        let root = temporary_root("heartbeat-replace");
        let path = root.join("heartbeat.json");
        write_json_atomic(
            &path,
            &HeartbeatState {
                last_ui_heartbeat_at: "first".to_owned(),
            },
        )
        .expect("first heartbeat persisted");
        write_json_atomic(
            &path,
            &HeartbeatState {
                last_ui_heartbeat_at: "second".to_owned(),
            },
        )
        .expect("second heartbeat replaced the first");

        let heartbeat: HeartbeatState =
            serde_json::from_slice(&fs::read(&path).expect("heartbeat state read"))
                .expect("heartbeat state valid");
        assert_eq!(heartbeat.last_ui_heartbeat_at, "second");
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn heartbeat_persistence_failure_is_bounded_and_non_fatal() {
        let root = temporary_root("heartbeat-degraded");
        let state =
            DiagnosticsState::initialize(root.clone(), "1.0.0".to_owned()).expect("session starts");
        fs::create_dir(&state.heartbeat_path).expect("blocking directory created");

        state
            .heartbeat()
            .expect("first failed write stays non-fatal");
        state
            .heartbeat()
            .expect("repeated failed write stays non-fatal");
        assert!(state.heartbeat_persistence_degraded.load(Ordering::Acquire));

        fs::remove_dir(&state.heartbeat_path).expect("blocking directory removed");
        state.heartbeat().expect("heartbeat recovers");
        assert!(!state.heartbeat_persistence_degraded.load(Ordering::Acquire));
        state.complete().expect("session completes");
        fs::remove_dir_all(root).expect("temporary root removed");
    }
}
