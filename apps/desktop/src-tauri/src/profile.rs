use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::OnceLock,
};

use crate::persistence::ProgressPersistence;

const PRODUCTION_IDENTIFIER: &str = "com.vakot.easytrimeditor";
const DEVELOPMENT_IDENTIFIER: &str = "com.vakot.easytrimeditor.dev";
const PREVIEW_IDENTIFIER: &str = "com.vakot.easytrimeditor.preview";
const FRESH_IDENTIFIER: &str = "com.vakot.easytrimeditor.dev.fresh";

static TEMPORARY_DIRECTORY: OnceLock<PathBuf> = OnceLock::new();

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AppProfile {
    Production,
    Development,
    FreshDevelopment,
    Preview,
}

impl AppProfile {
    /// Select before creating any plugin, window, path resolver, or persistence owner.
    pub fn detect(identifier: &str) -> io::Result<Self> {
        let executable = fs::canonicalize(std::env::current_exe()?)?;
        let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .expect("desktop package is inside the repository");
        let repository_binary = [repository, Path::new(env!("EASYTRIM_BUILD_DIRECTORY"))]
            .iter()
            .filter_map(|directory| fs::canonicalize(directory).ok())
            .any(|directory| executable.starts_with(directory));
        Self::select(
            identifier,
            repository_binary,
            cfg!(debug_assertions),
            std::env::var("EASYTRIM_REPOSITORY_PROFILE").ok().as_deref(),
            std::env::var("EASYTRIM_EPHEMERAL_PROGRESS").as_deref() == Ok("1"),
        )
    }

    fn select(
        identifier: &str,
        repository_binary: bool,
        debug: bool,
        requested: Option<&str>,
        fresh: bool,
    ) -> io::Result<Self> {
        let profile = match requested {
            Some("development") => Self::Development,
            Some("preview") => Self::Preview,
            Some(_) => return Err(io::Error::other("Unknown repository application profile")),
            None => match identifier {
                DEVELOPMENT_IDENTIFIER | FRESH_IDENTIFIER => Self::Development,
                PREVIEW_IDENTIFIER => Self::Preview,
                _ if repository_binary && debug => Self::Development,
                _ if repository_binary => Self::Preview,
                _ => Self::Production,
            },
        };
        Ok(if profile == Self::Development && debug && fresh {
            Self::FreshDevelopment
        } else {
            profile
        })
    }

    pub fn identifier(self) -> &'static str {
        match self {
            Self::Production => PRODUCTION_IDENTIFIER,
            Self::Development => DEVELOPMENT_IDENTIFIER,
            Self::FreshDevelopment => FRESH_IDENTIFIER,
            Self::Preview => PREVIEW_IDENTIFIER,
        }
    }

    pub fn progress_persistence(self) -> ProgressPersistence {
        if self == Self::FreshDevelopment {
            ProgressPersistence::Ephemeral
        } else {
            ProgressPersistence::Persistent
        }
    }

    /// Created once per native launch; reloads of its WebView keep the same token.
    pub fn ephemeral_session_id(self) -> Option<String> {
        (self.progress_persistence() == ProgressPersistence::Ephemeral)
            .then(|| uuid::Uuid::new_v4().to_string())
    }

    pub fn is_repository(self) -> bool {
        self != Self::Production
    }

    pub fn configure(self, config: &mut tauri::Config) {
        if !self.is_repository() {
            return;
        }
        config.identifier = self.identifier().to_owned();
        for window in &mut config.app.windows {
            // Windows/Linux default to app_local_data_dir for this identity. Never accept a
            // configured cross-profile data-directory override in a repository instance.
            window.data_directory = None;
            // WKWebView ignores data_directory. These stable, distinct UUIDs select persistent
            // stores on macOS 14+, regardless of the executable's bundle identity or origin.
            window.data_store_identifier = Some(match self {
                Self::Development => *b"EasyTrim-dev0001",
                Self::FreshDevelopment => *b"EasyTrim-fresh01",
                Self::Preview => *b"EasyTrim-prev001",
                Self::Production => unreachable!(),
            });
        }
    }

    pub fn initialize_temporary_directory(self) -> io::Result<()> {
        let system_temp = if self.is_repository() {
            fs::canonicalize(std::env::temp_dir())?
        } else {
            std::env::temp_dir()
        };
        let directory = self.prepare_temporary_directory(&system_temp)?;
        TEMPORARY_DIRECTORY
            .set(directory)
            .map_err(|_| io::Error::other("Application profile was already initialized"))
    }

    fn prepare_temporary_directory(self, system_temp: &Path) -> io::Result<PathBuf> {
        if !self.is_repository() {
            return Ok(system_temp.to_owned());
        }
        let mut directory = system_temp.to_owned();
        // A different prefix from legacy production artifacts prevents production's top-level
        // stale-artifact sweep from ever matching these profile directories.
        for component in ["easytrim-repository", self.identifier()] {
            directory.push(component);
            match fs::create_dir(&directory) {
                Ok(()) => {}
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(error),
            }
            let metadata = fs::symlink_metadata(&directory)?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(io::Error::other(
                    "Refusing linked application temporary directory",
                ));
            }
        }
        Ok(directory)
    }

    /// Older WKWebView silently falls back to the shared default store. Fail before opening it.
    pub fn validate_platform(self) -> io::Result<()> {
        #[cfg(target_os = "macos")]
        if self.is_repository() {
            let output = std::process::Command::new("/usr/bin/sw_vers")
                .arg("-productVersion")
                .output()?;
            let major = String::from_utf8_lossy(&output.stdout)
                .trim()
                .split('.')
                .next()
                .and_then(|version| version.parse::<u32>().ok());
            if !output.status.success() || !major.is_some_and(|version| version >= 14) {
                return Err(io::Error::other(
                    "Isolated repository WebView profiles require macOS 14 or newer",
                ));
            }
        }
        Ok(())
    }
}

/// All media artifact owners use the one directory selected at application startup.
/// Unit tests without an application bootstrap retain their independent temporary fixtures.
pub fn temporary_directory() -> PathBuf {
    TEMPORARY_DIRECTORY
        .get()
        .cloned()
        .unwrap_or_else(std::env::temp_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        application::{achievements::AchievementStore, statistics::StatisticsStore},
        domain::{
            achievements::{AchievementRecords, RecordIdentifier},
            statistics::{CompletedExport, ExportKind, UsageStatistics},
        },
        state::cleanup_stale_media_artifacts,
    };

    #[test]
    fn only_fresh_launches_have_distinct_ephemeral_session_tokens() {
        for profile in [
            AppProfile::Production,
            AppProfile::Development,
            AppProfile::Preview,
        ] {
            assert_eq!(profile.ephemeral_session_id(), None);
        }
        let first = AppProfile::FreshDevelopment.ephemeral_session_id().unwrap();
        let second = AppProfile::FreshDevelopment.ephemeral_session_id().unwrap();
        assert_ne!(first, second);
        assert!(uuid::Uuid::parse_str(&first).is_ok());
    }

    #[test]
    fn repository_release_and_debug_binaries_cannot_use_production() {
        let select = |repository, debug, requested, fresh| {
            AppProfile::select(PRODUCTION_IDENTIFIER, repository, debug, requested, fresh).unwrap()
        };
        assert_eq!(select(true, true, None, false), AppProfile::Development);
        assert_eq!(select(true, false, None, false), AppProfile::Preview);
        assert_eq!(select(true, true, None, true), AppProfile::FreshDevelopment);
        assert_eq!(select(false, false, None, true), AppProfile::Production);
        assert_eq!(
            select(true, false, Some("preview"), true),
            AppProfile::Preview
        );
        assert_eq!(
            select(false, true, Some("development"), true),
            AppProfile::FreshDevelopment
        );
        assert!(
            AppProfile::select(
                PRODUCTION_IDENTIFIER,
                true,
                false,
                Some("production"),
                false
            )
            .is_err()
        );
        // An explicitly built repository identity remains isolated even if the binary is moved.
        assert_eq!(
            AppProfile::select(PREVIEW_IDENTIFIER, false, false, None, false).unwrap(),
            AppProfile::Preview
        );
        assert_eq!(
            AppProfile::select(DEVELOPMENT_IDENTIFIER, false, true, None, false).unwrap(),
            AppProfile::Development
        );
    }

    #[test]
    fn profile_configuration_separates_all_tauri_paths_and_webkit_stores() {
        let original: tauri::Config =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        for (source, profile) in [
            (
                include_str!("../tauri.dev.conf.json"),
                AppProfile::Development,
            ),
            (
                include_str!("../tauri.preview.conf.json"),
                AppProfile::Preview,
            ),
        ] {
            let overlay: serde_json::Value = serde_json::from_str(source).unwrap();
            assert_eq!(overlay["identifier"], profile.identifier());
        }
        let mut production = original.clone();
        AppProfile::Production.configure(&mut production);
        assert_eq!(
            serde_json::to_value(production).unwrap(),
            serde_json::to_value(&original).unwrap()
        );
        let mut identifiers = std::collections::HashSet::new();
        let mut webkit_stores = std::collections::HashSet::new();
        for profile in [
            AppProfile::Development,
            AppProfile::FreshDevelopment,
            AppProfile::Preview,
        ] {
            let mut config = original.clone();
            profile.configure(&mut config);
            assert!(identifiers.insert(config.identifier.clone()));
            assert_ne!(config.identifier, original.identifier);
            let window = &config.app.windows[0];
            assert!(window.data_directory.is_none());
            assert!(webkit_stores.insert(window.data_store_identifier.unwrap()));
            assert_eq!(window.label, original.app.windows[0].label);
            assert_eq!(config.build.dev_url, original.build.dev_url);
        }
    }

    #[test]
    fn independent_profiles_reopen_saved_progress_and_fresh_sessions_do_not_change_it() {
        let root =
            std::env::temp_dir().join(format!("easytrim-profiles-test-{}", uuid::Uuid::new_v4()));
        let profiles = [
            AppProfile::Production,
            AppProfile::Development,
            AppProfile::Preview,
        ];
        for (index, profile) in profiles.iter().enumerate() {
            let data = root.join(profile.identifier());
            let (achievements, _) = AchievementStore::open(&data, profile.progress_persistence());
            achievements
                .unlock(&[RecordIdentifier::parse(
                    profile.identifier().rsplit('.').next().unwrap(),
                )
                .unwrap()])
                .write_result
                .unwrap();
            let (statistics, _) = StatisticsStore::open(&data, profile.progress_persistence());
            for _ in 0..=index {
                statistics
                    .record(&CompletedExport {
                        kind: ExportKind::Lossless,
                        processing_millis: 1,
                        data: None,
                        completed_at_millis: 1,
                    })
                    .unwrap();
            }
        }
        let fresh = AppProfile::FreshDevelopment;
        let fresh_root = root.join(fresh.identifier());
        let (achievements, _) = AchievementStore::open(&fresh_root, fresh.progress_persistence());
        assert_eq!(achievements.snapshot(), AchievementRecords::default());
        assert_eq!(
            achievements
                .unlock(&[RecordIdentifier::parse("first-contact").unwrap()])
                .value
                .1,
            ["first-contact"]
        );
        let (statistics, _) = StatisticsStore::open(&fresh_root, fresh.progress_persistence());
        assert_eq!(statistics.snapshot(), UsageStatistics::default());
        drop((achievements, statistics));
        assert_eq!(
            AchievementStore::open(&fresh_root, fresh.progress_persistence())
                .0
                .snapshot(),
            AchievementRecords::default()
        );
        assert!(!fresh_root.exists());
        for (index, profile) in profiles.iter().enumerate() {
            let data = root.join(profile.identifier());
            assert_eq!(
                AchievementStore::open(&data, profile.progress_persistence())
                    .0
                    .snapshot()
                    .unlocked_achievements
                    .len(),
                1
            );
            assert_eq!(
                StatisticsStore::open(&data, profile.progress_persistence())
                    .0
                    .snapshot()
                    .lossless_exports,
                index as u64 + 1
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn diagnostics_activity_and_crash_recovery_stay_in_their_own_profiles() {
        use crate::diagnostics::DiagnosticsState;

        let root = std::env::temp_dir().join(format!(
            "easytrim-profile-diagnostics-test-{}",
            uuid::Uuid::new_v4()
        ));
        let production_root = root.join(AppProfile::Production.identifier());
        let production =
            DiagnosticsState::initialize(production_root.clone(), "production".to_owned()).unwrap();
        let marker = production_root.join("diagnostics/current-session.json");
        let before = fs::read(&marker).unwrap();
        let production_session = production.bootstrap().unwrap().session_id;
        for profile in [
            AppProfile::Development,
            AppProfile::FreshDevelopment,
            AppProfile::Preview,
        ] {
            let data = root.join(profile.identifier());
            let state = DiagnosticsState::initialize(data.clone(), profile.identifier().to_owned())
                .unwrap();
            assert!(state.bootstrap().unwrap().recovery.is_none());
            assert!(state.list_persisted_sessions().unwrap().is_empty());
            assert!(
                state
                    .read_persisted_session_events(&production_session)
                    .unwrap()
                    .is_empty()
            );
            state.complete().unwrap();
            drop(state);
            let reopened =
                DiagnosticsState::initialize(data, profile.identifier().to_owned()).unwrap();
            assert_eq!(reopened.list_persisted_sessions().unwrap().len(), 1);
            assert!(reopened.bootstrap().unwrap().recovery.is_none());
            reopened.complete().unwrap();
        }
        assert_eq!(fs::read(marker).unwrap(), before);
        drop(production);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cleanup_is_limited_to_the_selected_profile_and_does_not_follow_links() {
        let root = std::env::temp_dir().join(format!(
            "easytrim-profile-cleanup-test-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir(&root).unwrap();
        let old = std::time::SystemTime::now() - std::time::Duration::from_secs(7200);
        let artifact = |parent: &Path| {
            let path = parent.join("easytrim-preview-old");
            fs::create_dir(&path).unwrap();
            let mut options = fs::OpenOptions::new();
            options.read(true);
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                options.custom_flags(
                    windows_sys::Win32::Storage::FileSystem::FILE_FLAG_BACKUP_SEMANTICS,
                );
                options.access_mode(windows_sys::Win32::Storage::FileSystem::FILE_WRITE_ATTRIBUTES);
            }
            options
                .open(&path)
                .and_then(|file| file.set_modified(old))
                .unwrap();
            path
        };
        // Production's legacy top-level artifacts, development, fresh, and preview are siblings.
        let production = artifact(&root);
        let dev = AppProfile::Development
            .prepare_temporary_directory(&root)
            .unwrap();
        let preview = AppProfile::Preview
            .prepare_temporary_directory(&root)
            .unwrap();
        let fresh = AppProfile::FreshDevelopment
            .prepare_temporary_directory(&root)
            .unwrap();
        let dev_artifact = artifact(&dev);
        let preview_artifact = artifact(&preview);
        let fresh_artifact = artifact(&fresh);
        cleanup_stale_media_artifacts(&preview);
        assert!(!preview_artifact.exists());
        assert!(production.exists() && dev_artifact.exists() && fresh_artifact.exists());
        cleanup_stale_media_artifacts(&root);
        assert!(!production.exists());
        assert!(dev_artifact.exists() && fresh_artifact.exists());

        let linked = preview.join("easytrim-preview-linked");
        #[cfg(windows)]
        assert!(
            std::process::Command::new("cmd")
                .args(["/C", "mklink", "/J"])
                .arg(&linked)
                .arg(&dev_artifact)
                .output()
                .unwrap()
                .status
                .success()
        );
        #[cfg(unix)]
        std::os::unix::fs::symlink(&dev_artifact, &linked).unwrap();
        cleanup_stale_media_artifacts(&preview);
        assert!(dev_artifact.exists());
        cleanup_stale_media_artifacts(&linked);
        assert!(dev_artifact.exists());
        let invalid_root = root.join("not-a-directory");
        fs::write(&invalid_root, "sentinel").unwrap();
        cleanup_stale_media_artifacts(&invalid_root);
        assert_eq!(fs::read(&invalid_root).unwrap(), b"sentinel");
        fs::remove_dir_all(root).unwrap();
    }
}
