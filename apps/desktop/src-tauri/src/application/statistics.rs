use std::{
    io,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
};

use crate::{
    application::unix_millis_now,
    domain::statistics::{
        CompletedExport, StatisticsDecodeError, StoredUsageStatistics, UsageStatistics,
        decode_usage_statistics,
    },
    persistence::{DocumentLoadIssue, LoadedDocument, load_json_document, write_json_atomic},
};

const STATISTICS_FILE_NAME: &str = "usage-statistics.json";

/// Application-wide usage statistics, persisted in the application data directory.
///
/// The mutex serializes every update, including its file write, so concurrent completions
/// cannot overwrite each other's totals.
pub struct StatisticsStore {
    path: PathBuf,
    state: Mutex<StoreState>,
}

struct StoreState {
    persistent: bool,
    statistics: UsageStatistics,
}

impl StatisticsStore {
    /// Loads statistics from `<root>/statistics/`. Never fails: a missing file starts from zero,
    /// and unusable files are reported through the returned issue.
    pub fn open(root: &Path) -> (Self, Option<DocumentLoadIssue>) {
        let path = root.join("statistics").join(STATISTICS_FILE_NAME);
        let LoadedDocument {
            value: statistics,
            persistent,
            issue,
        } = load_json_document(&path, unix_millis_now(), |bytes| {
            decode_usage_statistics(bytes).map_err(|error| match error {
                StatisticsDecodeError::Invalid => "invalid",
                StatisticsDecodeError::UnsupportedVersion(_) => "unsupported-version",
            })
        });
        (
            Self {
                path,
                state: Mutex::new(StoreState {
                    persistent,
                    statistics,
                }),
            },
            issue,
        )
    }

    pub fn snapshot(&self) -> UsageStatistics {
        self.lock().statistics.clone()
    }

    /// Adds one completed export. The in-memory totals always include it; the returned error
    /// reports only that persisting them failed, and a later successful write catches up.
    pub fn record(&self, export: &CompletedExport) -> io::Result<()> {
        let mut state = self.lock();
        state.statistics.record(export);
        if !state.persistent {
            return Ok(());
        }
        write_json_atomic(
            &self.path,
            &StoredUsageStatistics::current(&state.statistics),
        )
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, StoreState> {
        // A panic mid-update leaves plain counters behind, which remain safe to keep using.
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread};

    use uuid::Uuid;

    use super::*;
    use crate::domain::statistics::{ExportDataSizes, ExportKind};

    fn temporary_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "easytrim-statistics-test-{name}-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("temporary root created");
        root
    }

    fn completed(kind: ExportKind) -> CompletedExport {
        CompletedExport {
            kind,
            processing_millis: 250,
            data: Some(ExportDataSizes {
                source_bytes: 2_000,
                output_bytes: 500,
            }),
            completed_at_millis: 1_700_000_000_000,
        }
    }

    fn statistics_files(root: &Path) -> Vec<String> {
        let mut names = fs::read_dir(root.join("statistics"))
            .expect("statistics directory listed")
            .map(|entry| {
                entry
                    .expect("entry readable")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect::<Vec<_>>();
        names.sort();
        names
    }

    #[test]
    fn starts_empty_and_persists_across_reopening() {
        let root = temporary_root("persist");
        let (store, issue) = StatisticsStore::open(&root);
        assert_eq!(issue, None);
        assert_eq!(store.snapshot(), UsageStatistics::default());

        store
            .record(&completed(ExportKind::Lossless))
            .expect("first export persisted");
        store
            .record(&completed(ExportKind::Optimized))
            .expect("second export persisted");

        let (reopened, issue) = StatisticsStore::open(&root);
        assert_eq!(issue, None);
        let statistics = reopened.snapshot();
        assert_eq!(statistics, store.snapshot());
        assert_eq!(statistics.lossless_exports, 1);
        assert_eq!(statistics.optimized_exports, 1);
        assert_eq!(statistics.source_bytes, 4_000);
        assert_eq!(statistics_files(&root), [STATISTICS_FILE_NAME]);
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn concurrent_records_are_all_counted_and_persisted() {
        let root = temporary_root("concurrent");
        let store = Arc::new(StatisticsStore::open(&root).0);
        let workers = (0..8)
            .map(|_| {
                let store = Arc::clone(&store);
                thread::spawn(move || {
                    for _ in 0..5 {
                        store
                            .record(&completed(ExportKind::Optimized))
                            .expect("export persisted");
                    }
                })
            })
            .collect::<Vec<_>>();
        for worker in workers {
            worker.join().expect("worker finished");
        }

        assert_eq!(store.snapshot().optimized_exports, 40);
        assert_eq!(
            StatisticsStore::open(&root).0.snapshot().optimized_exports,
            40
        );
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn quarantines_an_invalid_file_and_starts_from_zero() {
        let root = temporary_root("invalid");
        fs::create_dir_all(root.join("statistics")).expect("statistics directory created");
        fs::write(
            root.join("statistics").join(STATISTICS_FILE_NAME),
            b"{broken",
        )
        .expect("corrupt file written");

        let (store, issue) = StatisticsStore::open(&root);
        assert_eq!(
            issue,
            Some(DocumentLoadIssue::Quarantined { reason: "invalid" })
        );
        assert_eq!(store.snapshot(), UsageStatistics::default());
        let files = statistics_files(&root);
        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with(".invalid.json"));

        store
            .record(&completed(ExportKind::Optimized))
            .expect("fresh statistics persisted");
        assert_eq!(statistics_files(&root).len(), 2);
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn preserves_a_newer_version_document_aside() {
        let root = temporary_root("newer");
        fs::create_dir_all(root.join("statistics")).expect("statistics directory created");
        fs::write(
            root.join("statistics").join(STATISTICS_FILE_NAME),
            br#"{"version":99,"optimizedExports":7}"#,
        )
        .expect("newer file written");

        let (_, issue) = StatisticsStore::open(&root);
        assert_eq!(
            issue,
            Some(DocumentLoadIssue::Quarantined {
                reason: "unsupported-version"
            })
        );
        let files = statistics_files(&root);
        assert!(files[0].ends_with(".unsupported-version.json"));
        let preserved = fs::read(root.join("statistics").join(&files[0])).expect("preserved");
        assert_eq!(preserved, br#"{"version":99,"optimizedExports":7}"#);
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn keeps_counting_in_memory_when_the_file_cannot_be_written() {
        let root = temporary_root("write-failure");
        let (store, _) = StatisticsStore::open(&root);
        fs::create_dir(root.join("statistics").join("usage-statistics.tmp"))
            .expect("blocking directory created");

        assert!(store.record(&completed(ExportKind::Lossless)).is_err());
        assert_eq!(store.snapshot().lossless_exports, 1);

        fs::remove_dir(root.join("statistics").join("usage-statistics.tmp"))
            .expect("blocking directory removed");
        store
            .record(&completed(ExportKind::Lossless))
            .expect("later write catches up");
        assert_eq!(
            StatisticsStore::open(&root).0.snapshot().lossless_exports,
            2
        );
        fs::remove_dir_all(root).expect("temporary root removed");
    }
}
