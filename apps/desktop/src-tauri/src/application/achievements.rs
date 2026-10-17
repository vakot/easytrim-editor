use std::{
    io,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
};

use crate::{
    application::unix_millis_now,
    domain::achievements::{
        AchievementRecords, AchievementsDecodeError, RecordIdentifier, StoredAchievementRecords,
        decode_achievement_records,
    },
    persistence::{DocumentLoadIssue, LoadedDocument, ProgressPersistence, write_json_atomic},
};

const ACHIEVEMENTS_FILE_NAME: &str = "achievements.json";

/// The records after an update, with whether persisting them failed. The in-memory records always
/// include the update; a later successful write persists the cumulative state.
pub struct AchievementUpdate<T> {
    pub value: T,
    pub write_result: io::Result<()>,
}

/// Application-wide achievement records, optionally persisted in the application data directory.
///
/// The mutex serializes every update, including its file write, so concurrent unlocks and
/// discoveries cannot overwrite each other or unlock an achievement twice.
pub struct AchievementStore {
    path: PathBuf,
    state: Mutex<StoreState>,
}

struct StoreState {
    persistent: bool,
    records: AchievementRecords,
}

impl AchievementStore {
    /// Loads records from `<root>/achievements/`. Never fails: a missing file starts empty, and
    /// unusable files are reported through the returned issue.
    /// Ephemeral sessions start empty and never read or write the saved document.
    pub fn open(root: &Path, mode: ProgressPersistence) -> (Self, Option<DocumentLoadIssue>) {
        let path = root.join("achievements").join(ACHIEVEMENTS_FILE_NAME);
        let LoadedDocument {
            value: records,
            persistent,
            issue,
        } = mode.load(&path, unix_millis_now(), |bytes| {
            decode_achievement_records(bytes).map_err(|error| match error {
                AchievementsDecodeError::Invalid => "invalid",
                AchievementsDecodeError::UnsupportedVersion(_) => "unsupported-version",
            })
        });
        (
            Self {
                path,
                state: Mutex::new(StoreState {
                    persistent,
                    records,
                }),
            },
            issue,
        )
    }

    pub fn snapshot(&self) -> AchievementRecords {
        self.lock().records.clone()
    }

    /// Unlocks the achievements that are not unlocked yet, at the current time, and returns the
    /// records with the newly unlocked identifiers. Nothing is written when nothing changed.
    pub fn unlock(
        &self,
        achievements: &[RecordIdentifier],
    ) -> AchievementUpdate<(AchievementRecords, Vec<String>)> {
        let mut state = self.lock();
        let unlocked = state.records.unlock(achievements, unix_millis_now());
        let write_result = if unlocked.is_empty() {
            Ok(())
        } else {
            self.persist(&state)
        };
        AchievementUpdate {
            value: (state.records.clone(), unlocked),
            write_result,
        }
    }

    /// Records a displayed splash message. Nothing is written for a message already discovered.
    pub fn discover_splash_message(
        &self,
        message: &RecordIdentifier,
    ) -> AchievementUpdate<AchievementRecords> {
        let mut state = self.lock();
        let write_result = if state.records.discover_splash_message(message) {
            self.persist(&state)
        } else {
            Ok(())
        };
        AchievementUpdate {
            value: state.records.clone(),
            write_result,
        }
    }

    /// Marks the collection as viewed now, so only later unlocks count as new.
    pub fn mark_viewed(&self) -> AchievementUpdate<AchievementRecords> {
        let mut state = self.lock();
        let write_result = if state.records.mark_viewed(unix_millis_now()) {
            self.persist(&state)
        } else {
            Ok(())
        };
        AchievementUpdate {
            value: state.records.clone(),
            write_result,
        }
    }

    fn persist(&self, state: &StoreState) -> io::Result<()> {
        if !state.persistent {
            return Ok(());
        }
        write_json_atomic(
            &self.path,
            &StoredAchievementRecords::current(&state.records),
        )
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, StoreState> {
        // Updates only insert entries, so records left by a panic remain safe to keep using.
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread};

    use uuid::Uuid;

    use super::*;

    fn temporary_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "easytrim-achievements-test-{name}-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("temporary root created");
        root
    }

    fn identifier(value: &str) -> RecordIdentifier {
        RecordIdentifier::parse(value).expect("identifier is valid")
    }

    fn achievement_files(root: &Path) -> Vec<String> {
        let mut names = fs::read_dir(root.join("achievements"))
            .expect("achievements directory listed")
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
    fn ephemeral_unlocks_and_discoveries_disappear_on_restart_without_changing_saved_progress() {
        let root = temporary_root("ephemeral");
        let path = root.join("achievements").join(ACHIEVEMENTS_FILE_NAME);
        let (saved, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        saved
            .unlock(&[identifier("saved-achievement")])
            .write_result
            .unwrap();
        let before = fs::read(&path).unwrap();
        {
            let (session, issue) = AchievementStore::open(&root, ProgressPersistence::Ephemeral);
            assert_eq!(issue, None);
            assert_eq!(session.snapshot(), AchievementRecords::default());
            let update = session.unlock(&[identifier("first-contact")]);
            update.write_result.unwrap();
            assert_eq!(update.value.1, ["first-contact"]);
            assert!(
                session
                    .snapshot()
                    .unlocked_achievements
                    .contains_key("first-contact")
            );
            assert!(
                session
                    .unlock(&[identifier("first-contact")])
                    .value
                    .1
                    .is_empty()
            );
            session
                .discover_splash_message(&identifier("rainbow-mode"))
                .write_result
                .unwrap();
            session.mark_viewed().write_result.unwrap();
            assert!(
                session
                    .snapshot()
                    .discovered_splash_message_ids
                    .contains("rainbow-mode")
            );
            assert!(session.snapshot().viewed_at_millis.is_some());
        }
        assert_eq!(fs::read(&path).unwrap(), before);
        assert_eq!(achievement_files(&root), [ACHIEVEMENTS_FILE_NAME]);
        let (restarted, _) = AchievementStore::open(&root, ProgressPersistence::Ephemeral);
        assert_eq!(restarted.snapshot(), AchievementRecords::default());
        assert_eq!(
            restarted.unlock(&[identifier("first-contact")]).value.1,
            ["first-contact"]
        );
        assert_eq!(
            AchievementStore::open(&root, ProgressPersistence::Persistent)
                .0
                .snapshot(),
            saved.snapshot()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn persists_unlocks_and_discoveries_across_reopening() {
        let root = temporary_root("persist");
        let (store, issue) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(issue, None);
        assert_eq!(store.snapshot(), AchievementRecords::default());

        let update = store.unlock(&[identifier("first-export")]);
        update.write_result.expect("unlock persisted");
        assert_eq!(update.value.1, ["first-export"]);
        store
            .discover_splash_message(&identifier("rainbow-mode"))
            .write_result
            .expect("discovery persisted");

        let (reopened, issue) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(issue, None);
        assert_eq!(reopened.snapshot(), store.snapshot());
        assert_eq!(achievement_files(&root), [ACHIEVEMENTS_FILE_NAME]);
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn persists_getting_started_unlocks_across_reopening() {
        let root = temporary_root("getting-started");
        let (store, issue) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(issue, None);
        let ids = [
            "first-contact",
            "cut-to-the-chase",
            "frame-by-frame",
            "fine-tuning",
            "queued-up",
            "shortcut-taken",
        ]
        .map(identifier);

        let update = store.unlock(&ids);
        update.write_result.expect("onboarding unlocks persisted");
        assert_eq!(update.value.1.len(), ids.len());

        let reopened = AchievementStore::open(&root, ProgressPersistence::Persistent)
            .0
            .snapshot();
        for id in [
            "first-contact",
            "cut-to-the-chase",
            "frame-by-frame",
            "fine-tuning",
            "queued-up",
            "shortcut-taken",
        ] {
            assert!(reopened.unlocked_achievements.contains_key(id));
        }
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn retired_achievements_keep_their_history_across_updates_and_restarts() {
        let root = temporary_root("retired");
        fs::create_dir_all(root.join("achievements")).expect("achievements directory created");
        fs::write(
            root.join("achievements").join(ACHIEVEMENTS_FILE_NAME),
            br#"{"version":2,"unlockedAchievements":{"retired-achievement":{"unlockedAtMillis":77}}}"#,
        )
        .expect("records written");

        let (store, issue) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(issue, None);
        store
            .unlock(&[identifier("gold-collector")])
            .write_result
            .expect("unlock persisted");

        let records = AchievementStore::open(&root, ProgressPersistence::Persistent)
            .0
            .snapshot();
        assert_eq!(
            records.unlocked_achievements["retired-achievement"].unlocked_at_millis,
            77
        );
        assert!(records.unlocked_achievements.contains_key("gold-collector"));
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn unlocking_an_already_unlocked_achievement_does_not_write_again() {
        let root = temporary_root("repeat-write");
        let (store, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        store
            .unlock(&[identifier("bronze-collector")])
            .write_result
            .expect("unlock persisted");
        // A directory at the temporary path makes every write fail, so only skipped writes pass.
        fs::create_dir(root.join("achievements").join("achievements.tmp"))
            .expect("blocking directory created");

        let update = store.unlock(&[
            identifier("bronze-collector"),
            identifier("bronze-collector"),
        ]);

        assert!(update.write_result.is_ok());
        assert!(update.value.1.is_empty());
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn persists_the_viewed_mark_across_reopening() {
        let root = temporary_root("viewed");
        let (store, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(store.snapshot().viewed_at_millis, None);

        let update = store.mark_viewed();
        update.write_result.expect("viewed mark persisted");
        let viewed_at = update
            .value
            .viewed_at_millis
            .expect("collection marked viewed");

        let (reopened, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(reopened.snapshot().viewed_at_millis, Some(viewed_at));
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn repeated_unlocks_after_restart_keep_the_original_time() {
        let root = temporary_root("repeat");
        let (store, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        let first = store.unlock(&[identifier("first-export")]).value.0;
        let unlocked_at = first.unlocked_achievements["first-export"].unlocked_at_millis;

        let (reopened, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        let (records, unlocked) = reopened.unlock(&[identifier("first-export")]).value;
        assert!(unlocked.is_empty());
        assert_eq!(
            records.unlocked_achievements["first-export"].unlocked_at_millis,
            unlocked_at
        );
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn unchanged_records_are_not_rewritten() {
        let root = temporary_root("unchanged");
        let (store, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        store
            .discover_splash_message(&identifier("rainbow-mode"))
            .write_result
            .expect("discovery persisted");
        // A directory at the temporary path makes every write fail, so only skipped writes pass.
        fs::create_dir(root.join("achievements").join("achievements.tmp"))
            .expect("blocking directory created");

        assert!(
            store
                .discover_splash_message(&identifier("rainbow-mode"))
                .write_result
                .is_ok()
        );
        assert!(store.unlock(&[]).write_result.is_ok());
        assert!(
            store
                .unlock(&[identifier("gif-maker")])
                .write_result
                .is_err()
        );
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn concurrent_unlocks_unlock_each_achievement_once() {
        let root = temporary_root("concurrent");
        let store = Arc::new(AchievementStore::open(&root, ProgressPersistence::Persistent).0);
        let workers = (0..8)
            .map(|_| {
                let store = Arc::clone(&store);
                thread::spawn(move || {
                    store
                        .unlock(&[identifier("first-export"), identifier("getting-started")])
                        .value
                        .1
                })
            })
            .collect::<Vec<_>>();
        let mut unlocked = workers
            .into_iter()
            .flat_map(|worker| worker.join().expect("worker finished"))
            .collect::<Vec<_>>();
        unlocked.sort();

        assert_eq!(unlocked, ["first-export", "getting-started"]);
        assert_eq!(
            AchievementStore::open(&root, ProgressPersistence::Persistent)
                .0
                .snapshot()
                .unlocked_achievements
                .len(),
            2
        );
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn quarantines_an_invalid_file_and_starts_empty() {
        let root = temporary_root("invalid");
        fs::create_dir_all(root.join("achievements")).expect("achievements directory created");
        fs::write(
            root.join("achievements").join(ACHIEVEMENTS_FILE_NAME),
            b"{broken",
        )
        .expect("corrupt file written");

        let (store, issue) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        assert_eq!(
            issue,
            Some(DocumentLoadIssue::Quarantined { reason: "invalid" })
        );
        assert_eq!(store.snapshot(), AchievementRecords::default());
        let files = achievement_files(&root);
        assert_eq!(files.len(), 1);
        assert!(files[0].starts_with("achievements."));
        assert!(files[0].ends_with(".invalid.json"));
        fs::remove_dir_all(root).expect("temporary root removed");
    }

    #[test]
    fn keeps_updates_in_memory_when_the_file_cannot_be_written() {
        let root = temporary_root("write-failure");
        let (store, _) = AchievementStore::open(&root, ProgressPersistence::Persistent);
        fs::create_dir(root.join("achievements").join("achievements.tmp"))
            .expect("blocking directory created");

        let update = store.unlock(&[identifier("first-export")]);
        assert!(update.write_result.is_err());
        assert_eq!(update.value.1, ["first-export"]);
        assert!(
            store
                .snapshot()
                .unlocked_achievements
                .contains_key("first-export")
        );

        fs::remove_dir(root.join("achievements").join("achievements.tmp"))
            .expect("blocking directory removed");
        store
            .unlock(&[identifier("gif-maker")])
            .write_result
            .expect("later write catches up");
        assert_eq!(
            AchievementStore::open(&root, ProgressPersistence::Persistent)
                .0
                .snapshot()
                .unlocked_achievements
                .len(),
            2
        );
        fs::remove_dir_all(root).expect("temporary root removed");
    }
}
