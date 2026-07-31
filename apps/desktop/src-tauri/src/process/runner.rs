use std::{
    ffi::{OsStr, OsString},
    io::{self, Read},
    process::{Command, ExitStatus, Stdio},
    thread,
    time::Duration,
};

use wait_timeout::ChildExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
    let mut command = Command::new(executable);
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

    let status = match child.wait_timeout(timeout) {
        Ok(Some(status)) => status,
        Ok(None) => {
            terminate_child(&mut child)?;
            join_reader(stdout_reader)?;
            join_reader(stderr_reader)?;
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "media helper process timed out",
            ));
        }
        Err(error) => {
            let _ = terminate_child(&mut child);
            join_reader(stdout_reader)?;
            join_reader(stderr_reader)?;
            return Err(error);
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
    use std::io::Cursor;

    use super::read_bounded;

    #[test]
    fn bounded_reader_drains_but_retains_only_the_limit() {
        let input = Cursor::new(b"0123456789");
        let (retained, truncated) = read_bounded(input, 4).expect("input is readable");

        assert_eq!(retained, b"0123");
        assert!(truncated);
    }
}
