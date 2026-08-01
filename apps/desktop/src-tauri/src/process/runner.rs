use std::{
    ffi::{OsStr, OsString},
    fs,
    io::{self, BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Command, ExitStatus, Stdio},
    thread,
    time::{Duration, Instant},
};

use wait_timeout::ChildExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const PROCESS_POLL_INTERVAL: Duration = Duration::from_millis(100);

#[derive(Debug)]
pub struct ProcessOutput {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
}

pub fn run_bounded(
    executable: &OsStr,
    arguments: &[OsString],
    timeout: Duration,
    max_stdout_bytes: usize,
    max_stderr_bytes: usize,
) -> io::Result<ProcessOutput> {
    run_bounded_cancellable(
        executable,
        arguments,
        timeout,
        max_stdout_bytes,
        max_stderr_bytes,
        || false,
    )
}

pub fn run_bounded_cancellable(
    executable: &OsStr,
    arguments: &[OsString],
    timeout: Duration,
    max_stdout_bytes: usize,
    max_stderr_bytes: usize,
    mut is_cancelled: impl FnMut() -> bool,
) -> io::Result<ProcessOutput> {
    if is_cancelled() {
        return Err(cancelled_error());
    }

    let executable_path = resolve_executable(executable)?;
    let mut command = Command::new(executable_path);
    command
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_process(&mut command);

    let mut child = command.spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("child stdout was not captured"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| io::Error::other("child stderr was not captured"))?;

    let stdout_reader = thread::spawn(move || read_bounded(stdout, max_stdout_bytes));
    let stderr_reader = thread::spawn(move || read_bounded(stderr, max_stderr_bytes));

    let started_at = Instant::now();
    let status = loop {
        if is_cancelled() {
            terminate_child(&mut child)?;
            join_reader(stdout_reader)?;
            join_reader(stderr_reader)?;
            return Err(cancelled_error());
        }

        let elapsed = started_at.elapsed();
        if elapsed >= timeout {
            terminate_child(&mut child)?;
            join_reader(stdout_reader)?;
            join_reader(stderr_reader)?;
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "media helper process timed out",
            ));
        }

        let wait_duration = PROCESS_POLL_INTERVAL.min(timeout - elapsed);
        match child.wait_timeout(wait_duration) {
            Ok(Some(status)) => break status,
            Ok(None) => {}
            Err(error) => {
                let _ = terminate_child(&mut child);
                join_reader(stdout_reader)?;
                join_reader(stderr_reader)?;
                return Err(error);
            }
        }
    };

    let (stdout, stdout_truncated) = join_reader(stdout_reader)?;
    let (stderr, stderr_truncated) = join_reader(stderr_reader)?;

    Ok(ProcessOutput {
        status,
        stdout,
        stderr,
        stdout_truncated,
        stderr_truncated,
    })
}

pub fn run_progress_cancellable(
    executable: &OsStr,
    arguments: &[OsString],
    timeout: Duration,
    max_stdout_bytes: usize,
    max_stderr_bytes: usize,
    mut is_cancelled: impl FnMut() -> bool,
    mut on_progress_line: impl FnMut(&str),
) -> io::Result<ProcessOutput> {
    if is_cancelled() {
        return Err(cancelled_error());
    }

    let executable_path = resolve_executable(executable)?;
    let mut command = Command::new(executable_path);
    command
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_process(&mut command);

    let mut child = command.spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("child stdout was not captured"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| io::Error::other("child stderr was not captured"))?;
    let (progress_sender, progress_receiver) = std::sync::mpsc::channel::<io::Result<String>>();
    let stdout_reader = thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut retained = Vec::with_capacity(max_stdout_bytes.min(16 * 1024));
        let mut truncated = false;
        let mut line = String::new();
        loop {
            line.clear();
            let read = reader.read_line(&mut line)?;
            if read == 0 {
                break;
            }
            let remaining = max_stdout_bytes.saturating_sub(retained.len());
            let bytes = line.as_bytes();
            let to_retain = remaining.min(bytes.len());
            retained.extend_from_slice(&bytes[..to_retain]);
            truncated |= to_retain < bytes.len();
            if progress_sender
                .send(Ok(line.trim_end().to_owned()))
                .is_err()
            {
                break;
            }
        }
        Ok::<_, io::Error>((retained, truncated))
    });
    let stderr_reader = thread::spawn(move || read_bounded(stderr, max_stderr_bytes));

    let started_at = Instant::now();
    let status = loop {
        while let Ok(line) = progress_receiver.try_recv() {
            on_progress_line(&line?);
        }
        if is_cancelled() {
            terminate_child(&mut child)?;
            join_reader(stdout_reader)?;
            join_reader(stderr_reader)?;
            return Err(cancelled_error());
        }
        let elapsed = started_at.elapsed();
        if elapsed >= timeout {
            terminate_child(&mut child)?;
            join_reader(stdout_reader)?;
            join_reader(stderr_reader)?;
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "media helper process timed out",
            ));
        }
        match child.wait_timeout(PROCESS_POLL_INTERVAL.min(timeout - elapsed)) {
            Ok(Some(status)) => break status,
            Ok(None) => {}
            Err(error) => {
                let _ = terminate_child(&mut child);
                join_reader(stdout_reader)?;
                join_reader(stderr_reader)?;
                return Err(error);
            }
        }
    };

    let (stdout, stdout_truncated) = join_reader(stdout_reader)?;
    while let Ok(line) = progress_receiver.try_recv() {
        on_progress_line(&line?);
    }
    let (stderr, stderr_truncated) = join_reader(stderr_reader)?;
    Ok(ProcessOutput {
        status,
        stdout,
        stderr,
        stdout_truncated,
        stderr_truncated,
    })
}

fn cancelled_error() -> io::Error {
    io::Error::new(
        io::ErrorKind::Interrupted,
        "media helper process was cancelled",
    )
}

fn read_bounded(mut reader: impl Read, limit: usize) -> io::Result<(Vec<u8>, bool)> {
    let mut retained = Vec::with_capacity(limit.min(16 * 1024));
    let mut buffer = [0_u8; 8 * 1024];
    let mut truncated = false;

    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }

        let remaining = limit.saturating_sub(retained.len());
        let to_retain = remaining.min(read);
        retained.extend_from_slice(&buffer[..to_retain]);
        truncated |= to_retain < read;
    }

    Ok((retained, truncated))
}

fn join_reader(
    reader: thread::JoinHandle<io::Result<(Vec<u8>, bool)>>,
) -> io::Result<(Vec<u8>, bool)> {
    reader
        .join()
        .map_err(|_| io::Error::other("media helper output reader stopped unexpectedly"))?
}

fn resolve_executable(executable: &OsStr) -> io::Result<PathBuf> {
    let executable_path = Path::new(executable);
    if executable_path.is_absolute() || executable_path.components().count() > 1 {
        return is_executable_file(executable_path)
            .then(|| executable_path.to_owned())
            .ok_or_else(|| executable_not_found(executable));
    }

    let path = std::env::var_os("PATH").unwrap_or_default();
    let mut search_paths = std::env::split_paths(&path).collect::<Vec<_>>();

    #[cfg(target_os = "macos")]
    search_paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ]);

    find_executable(executable, search_paths).ok_or_else(|| executable_not_found(executable))
}

fn find_executable(
    executable: &OsStr,
    search_paths: impl IntoIterator<Item = PathBuf>,
) -> Option<PathBuf> {
    search_paths.into_iter().find_map(|directory| {
        let candidate = directory.join(executable);
        if is_executable_file(&candidate) {
            return Some(candidate);
        }

        #[cfg(windows)]
        if Path::new(executable).extension().is_none() {
            let candidate = candidate.with_extension("exe");
            if is_executable_file(&candidate) {
                return Some(candidate);
            }
        }

        None
    })
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        metadata.permissions().mode() & 0o111 != 0
    }

    #[cfg(not(unix))]
    {
        true
    }
}

fn executable_not_found(executable: &OsStr) -> io::Error {
    io::Error::new(
        io::ErrorKind::NotFound,
        format!("executable {:?} was not found on PATH", executable),
    )
}

fn terminate_child(child: &mut std::process::Child) -> io::Result<()> {
    if let Err(kill_error) = child.kill()
        && child.try_wait()?.is_none()
    {
        return Err(kill_error);
    }
    child.wait().map(|_| ())
}

#[cfg(windows)]
fn configure_process(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn configure_process(_command: &mut Command) {}

#[cfg(test)]
mod tests {
    use std::{
        ffi::OsStr,
        io::{self, Cursor},
        time::Duration,
    };

    use super::{
        read_bounded, resolve_executable, run_bounded_cancellable, run_progress_cancellable,
    };

    #[test]
    fn resolves_an_executable_from_the_process_environment() {
        let executable = if cfg!(windows) { "cmd.exe" } else { "sh" };
        let path = resolve_executable(OsStr::new(executable)).expect("system shell is available");

        assert!(path.is_absolute());
    }

    #[test]
    fn bounded_reader_drains_but_retains_only_the_limit() {
        let input = Cursor::new(b"0123456789");
        let (retained, truncated) = read_bounded(input, 4).expect("input is readable");

        assert_eq!(retained, b"0123");
        assert!(truncated);
    }

    #[test]
    fn cancellation_is_checked_before_spawning_a_process() {
        let error = run_bounded_cancellable(
            OsStr::new("this-process-must-not-start"),
            &[],
            Duration::from_secs(1),
            0,
            0,
            || true,
        )
        .expect_err("cancelled execution must stop before process lookup");

        assert_eq!(error.kind(), io::ErrorKind::Interrupted);
    }

    #[test]
    fn progress_process_reports_prelaunch_cancellation_and_spawn_failure() {
        let cancelled = run_progress_cancellable(
            OsStr::new("this-process-must-not-start"),
            &[],
            Duration::from_secs(1),
            0,
            0,
            || true,
            |_| {},
        )
        .expect_err("cancelled export must stop before process lookup");
        assert_eq!(cancelled.kind(), io::ErrorKind::Interrupted);

        let missing = run_progress_cancellable(
            OsStr::new("easytrim-process-that-does-not-exist"),
            &[],
            Duration::from_secs(1),
            0,
            0,
            || false,
            |_| {},
        )
        .expect_err("missing export process must fail");
        assert_eq!(missing.kind(), io::ErrorKind::NotFound);
    }
}
