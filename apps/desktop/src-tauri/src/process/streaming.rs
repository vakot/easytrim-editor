use std::{
    ffi::{OsStr, OsString},
    io::{self, Read},
    process::{Child, Command, Stdio},
    sync::{
        Arc, Mutex,
        mpsc::{Receiver, RecvTimeoutError, SyncSender, sync_channel},
    },
    thread,
    time::{Duration, Instant},
};

use super::runner::{configure_process, media_debug, resolve_executable};

const READ_BLOCK_BYTES: usize = 64 * 1024;
// Bounded read-ahead: the child blocks on a full pipe until its output is consumed.
const READ_AHEAD_BLOCKS: usize = 4;
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// A long-lived child whose stdout is consumed incrementally, so one process can serve many
/// consecutive reads. Dropping it terminates the child and joins its reader threads.
pub struct StreamingChild {
    child: Arc<Mutex<Child>>,
    blocks: Receiver<io::Result<Vec<u8>>>,
    pending: Vec<u8>,
    ended: bool,
    stdout_reader: Option<thread::JoinHandle<()>>,
    stderr_reader: Option<thread::JoinHandle<()>>,
}

/// Terminates a [`StreamingChild`] from another thread, for example when its work is superseded
/// while a reader is waiting for output.
#[derive(Clone)]
pub struct ChildTerminator {
    child: Arc<Mutex<Child>>,
}

impl ChildTerminator {
    pub fn terminate(&self) {
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
        }
    }
}

impl StreamingChild {
    /// Starts the child. Its stderr is drained and discarded so diagnostics can never fill the
    /// pipe and stall the output.
    pub fn spawn(executable: &OsStr, arguments: &[OsString]) -> io::Result<Self> {
        let executable_path = resolve_executable(executable)?;
        media_debug(format_args!(
            "start streaming {} {:?}",
            executable_path.display(),
            arguments
        ));
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
        let (sender, blocks) = sync_channel(READ_AHEAD_BLOCKS);
        let stdout_reader = thread::spawn(move || forward_blocks(stdout, &sender));
        let stderr_reader = thread::spawn(move || {
            let _ = io::copy(&mut { stderr }, &mut io::sink());
        });

        Ok(Self {
            child: Arc::new(Mutex::new(child)),
            blocks,
            pending: Vec::new(),
            ended: false,
            stdout_reader: Some(stdout_reader),
            stderr_reader: Some(stderr_reader),
        })
    }

    pub fn terminator(&self) -> ChildTerminator {
        ChildTerminator {
            child: Arc::clone(&self.child),
        }
    }

    /// Reads exactly `length` bytes, or fewer only when the output ended. While waiting it polls
    /// `is_cancelled` and fails with `TimedOut` when no output arrives within `idle_timeout`.
    pub fn read_exact_cancellable(
        &mut self,
        length: usize,
        idle_timeout: Duration,
        mut is_cancelled: impl FnMut() -> bool,
    ) -> io::Result<Vec<u8>> {
        let mut last_output = Instant::now();
        while self.pending.len() < length && !self.ended {
            if is_cancelled() {
                return Err(io::Error::new(
                    io::ErrorKind::Interrupted,
                    "streaming media helper read was cancelled",
                ));
            }
            match self.blocks.recv_timeout(POLL_INTERVAL) {
                Ok(Ok(block)) => {
                    self.pending.extend_from_slice(&block);
                    last_output = Instant::now();
                }
                Ok(Err(error)) => return Err(error),
                Err(RecvTimeoutError::Disconnected) => self.ended = true,
                Err(RecvTimeoutError::Timeout) if last_output.elapsed() >= idle_timeout => {
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        "streaming media helper produced no output in time",
                    ));
                }
                Err(RecvTimeoutError::Timeout) => {}
            }
        }
        let take = length.min(self.pending.len());
        Ok(self.pending.drain(..take).collect())
    }
}

impl Drop for StreamingChild {
    fn drop(&mut self) {
        self.terminator().terminate();
        if let Ok(mut child) = self.child.lock() {
            let _ = child.wait();
        }
        // Killing the child ends both pipes; closing the channel also releases a reader that is
        // waiting for read-ahead space.
        drop(std::mem::replace(&mut self.blocks, sync_channel(0).1));
        if let Some(reader) = self.stdout_reader.take() {
            let _ = reader.join();
        }
        if let Some(reader) = self.stderr_reader.take() {
            let _ = reader.join();
        }
    }
}

fn forward_blocks(mut stdout: impl Read, sender: &SyncSender<io::Result<Vec<u8>>>) {
    let mut buffer = vec![0_u8; READ_BLOCK_BYTES];
    loop {
        match stdout.read(&mut buffer) {
            Ok(0) => return,
            Ok(read) => {
                if sender.send(Ok(buffer[..read].to_vec())).is_err() {
                    return;
                }
            }
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            Err(error) => {
                let _ = sender.send(Err(error));
                return;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        ffi::{OsStr, OsString},
        io,
        time::Duration,
    };

    use super::StreamingChild;

    fn raw_output(frames: u32) -> StreamingChild {
        StreamingChild::spawn(
            OsStr::new("ffmpeg"),
            &[
                OsString::from("-hide_banner"),
                OsString::from("-nostdin"),
                OsString::from("-v"),
                OsString::from("error"),
                OsString::from("-f"),
                OsString::from("lavfi"),
                OsString::from("-i"),
                OsString::from(format!(
                    "anullsrc=r=48000:cl=mono,atrim=end_sample={frames}"
                )),
                OsString::from("-f"),
                OsString::from("s16le"),
                OsString::from("pipe:1"),
            ],
        )
        .expect("FFmpeg starts")
    }

    #[test]
    fn serves_consecutive_reads_from_one_process_and_reports_the_end() {
        let mut child = raw_output(48_000);
        let first = child
            .read_exact_cancellable(1_000, Duration::from_secs(10), || false)
            .unwrap();
        let second = child
            .read_exact_cancellable(95_000, Duration::from_secs(10), || false)
            .unwrap();
        let tail = child
            .read_exact_cancellable(10_000, Duration::from_secs(10), || false)
            .unwrap();
        assert_eq!(first.len(), 1_000);
        assert_eq!(second.len(), 95_000);
        assert!(tail.is_empty());
    }

    #[test]
    fn cancellation_and_termination_stop_a_blocked_reader() {
        let mut child = raw_output(48_000 * 600);
        let cancelled = child
            .read_exact_cancellable(usize::MAX / 2, Duration::from_secs(10), || true)
            .unwrap_err();
        assert_eq!(cancelled.kind(), io::ErrorKind::Interrupted);

        child.terminator().terminate();
        let remaining = child
            .read_exact_cancellable(usize::MAX / 2, Duration::from_secs(10), || false)
            .unwrap();
        assert!(remaining.len() < 48_000 * 600 * 2);
    }
}
