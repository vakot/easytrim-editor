use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Schema version written to the achievements document. Bump it together with a migration arm in
/// [`decode_achievement_records`] whenever the stored shape changes incompatibly.
pub const ACHIEVEMENTS_VERSION: u64 = 2;

const MAX_IDENTIFIER_LENGTH: usize = 64;

/// Version 1 stored standalone milestones; version 2 groups them into Bronze, Silver, and Gold tiers
/// of milestone series. Each version 1 achievement equivalent to a tier keeps its unlock time under
/// the tier's identifier. Retired achievements without an equivalent tier are dropped: progress
/// comes from usage statistics, so the tiers they imply unlock again when next evaluated.
const VERSION_1_ACHIEVEMENT_MIGRATIONS: &[(&str, Option<&str>)] = &[
    ("first-export", Some("export-mastery-bronze")),
    ("getting-started", Some("export-mastery-silver")),
    ("export-veteran", Some("export-mastery-gold")),
    ("export-legend", None),
    ("first-lossless-cut", Some("lossless-precision-bronze")),
    ("lossless-legend", None),
    ("gif-maker", Some("gif-creator-bronze")),
    ("audio-specialist", None),
    ("one-hour-later", Some("time-well-spent-gold")),
    ("working-overtime", None),
    ("data-cruncher", Some("data-cruncher-gold")),
    ("storage-saver", Some("storage-saver-gold")),
];

/// Upper bound for each recorded collection, so a misbehaving client cannot grow the document
/// without limit. It is far above the size of the achievement and splash message catalogs.
pub const MAX_RECORDED_ENTRIES: usize = 256;

/// An achievement or splash message identifier: lowercase ASCII letters, digits, and inner
/// hyphens, at most 64 bytes. The frontend owns the catalogs; the native layer only stores IDs.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct RecordIdentifier(String);

impl RecordIdentifier {
    pub fn parse(value: &str) -> Option<Self> {
        let valid = !value.is_empty()
            && value.len() <= MAX_IDENTIFIER_LENGTH
            && !value.starts_with('-')
            && !value.ends_with('-')
            && value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
        valid.then(|| Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockedAchievement {
    /// Unix epoch milliseconds when the achievement was first recognized as unlocked.
    pub unlocked_at_millis: i64,
}

/// Achievement progress that cannot be derived from usage statistics.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AchievementRecords {
    pub unlocked_achievements: BTreeMap<String, UnlockedAchievement>,
    pub discovered_splash_message_ids: BTreeSet<String>,
    /// Unix epoch milliseconds when the collection was last viewed. Achievements unlocked later
    /// are new to the user; `None` means the collection was never viewed.
    pub viewed_at_millis: Option<i64>,
}

impl AchievementRecords {
    /// Unlocks every achievement that is not unlocked yet and returns those identifiers. An
    /// existing unlock keeps its original time.
    pub fn unlock(&mut self, achievements: &[RecordIdentifier], now_millis: i64) -> Vec<String> {
        let mut unlocked = Vec::new();
        for achievement in achievements {
            if self
                .unlocked_achievements
                .contains_key(achievement.as_str())
                || self.unlocked_achievements.len() >= MAX_RECORDED_ENTRIES
            {
                continue;
            }
            self.unlocked_achievements.insert(
                achievement.as_str().to_owned(),
                UnlockedAchievement {
                    unlocked_at_millis: now_millis,
                },
            );
            unlocked.push(achievement.as_str().to_owned());
        }
        unlocked
    }

    /// Marks the collection as viewed at `now_millis`; returns whether that moved the mark. The mark
    /// never moves back, so a late or repeated request cannot make seen achievements new again.
    pub fn mark_viewed(&mut self, now_millis: i64) -> bool {
        if self
            .viewed_at_millis
            .is_some_and(|viewed| viewed >= now_millis)
        {
            return false;
        }
        self.viewed_at_millis = Some(now_millis);
        true
    }

    /// Records a displayed splash message; returns whether it was not discovered before.
    pub fn discover_splash_message(&mut self, message: &RecordIdentifier) -> bool {
        if self.discovered_splash_message_ids.len() >= MAX_RECORDED_ENTRIES {
            return false;
        }
        self.discovered_splash_message_ids
            .insert(message.as_str().to_owned())
    }

    /// Renames version 1 achievement identifiers to their version 2 equivalents.
    fn migrate_from_version_1(mut self) -> Self {
        let unlocked = std::mem::take(&mut self.unlocked_achievements);
        for (id, unlock) in unlocked {
            let migrated = VERSION_1_ACHIEVEMENT_MIGRATIONS
                .iter()
                .find(|(previous, _)| *previous == id)
                .map_or(Some(id.as_str()), |(_, current)| *current);
            if let Some(migrated) = migrated {
                self.unlocked_achievements
                    .entry(migrated.to_owned())
                    .and_modify(|existing| {
                        existing.unlocked_at_millis =
                            existing.unlocked_at_millis.min(unlock.unlocked_at_millis);
                    })
                    .or_insert(unlock);
            }
        }
        self
    }

    fn is_valid(&self) -> bool {
        self.unlocked_achievements.len() <= MAX_RECORDED_ENTRIES
            && self.discovered_splash_message_ids.len() <= MAX_RECORDED_ENTRIES
            && self
                .unlocked_achievements
                .keys()
                .chain(&self.discovered_splash_message_ids)
                .all(|identifier| RecordIdentifier::parse(identifier).is_some())
    }
}

/// The on-disk document: the current schema version followed by the record fields.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAchievementRecords {
    version: u64,
    #[serde(flatten)]
    records: AchievementRecords,
}

impl StoredAchievementRecords {
    pub fn current(records: &AchievementRecords) -> Self {
        Self {
            version: ACHIEVEMENTS_VERSION,
            records: records.clone(),
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum AchievementsDecodeError {
    /// The document is not JSON, has no numeric version, or has invalid field values.
    Invalid,
    /// The document was written by a newer or unknown schema version.
    UnsupportedVersion(u64),
}

/// Decodes a stored achievements document, migrating older schema versions to the current shape.
/// Fields missing from a known version take their empty defaults.
pub fn decode_achievement_records(
    bytes: &[u8],
) -> Result<AchievementRecords, AchievementsDecodeError> {
    let document: Value =
        serde_json::from_slice(bytes).map_err(|_| AchievementsDecodeError::Invalid)?;
    let version = document
        .get("version")
        .and_then(Value::as_u64)
        .ok_or(AchievementsDecodeError::Invalid)?;
    let records = match version {
        1 | ACHIEVEMENTS_VERSION => serde_json::from_value::<StoredAchievementRecords>(document)
            .map(|stored| stored.records)
            .ok()
            .filter(AchievementRecords::is_valid)
            .ok_or(AchievementsDecodeError::Invalid)?,
        other => return Err(AchievementsDecodeError::UnsupportedVersion(other)),
    };
    Ok(if version == 1 {
        records.migrate_from_version_1()
    } else {
        records
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identifier(value: &str) -> RecordIdentifier {
        RecordIdentifier::parse(value).expect("identifier is valid")
    }

    #[test]
    fn accepts_only_bounded_kebab_case_identifiers() {
        assert!(RecordIdentifier::parse("first-export").is_some());
        assert!(RecordIdentifier::parse("export-100").is_some());
        assert!(RecordIdentifier::parse(&"a".repeat(64)).is_some());

        for invalid in [
            "",
            "First-Export",
            "first_export",
            "first export",
            "-first",
            "first-",
            "../first",
            "первый",
            &"a".repeat(65),
        ] {
            assert!(RecordIdentifier::parse(invalid).is_none(), "{invalid:?}");
        }
    }

    #[test]
    fn unlocks_each_achievement_once_and_keeps_its_original_time() {
        let mut records = AchievementRecords::default();

        assert_eq!(
            records.unlock(
                &[identifier("first-export"), identifier("first-export")],
                1_000
            ),
            ["first-export"]
        );
        assert_eq!(
            records.unlock(
                &[identifier("first-export"), identifier("gif-maker")],
                2_000
            ),
            ["gif-maker"]
        );
        assert!(
            records
                .unlock(&[identifier("first-export")], 3_000)
                .is_empty()
        );

        assert_eq!(
            records.unlocked_achievements["first-export"].unlocked_at_millis,
            1_000
        );
        assert_eq!(
            records.unlocked_achievements["gif-maker"].unlocked_at_millis,
            2_000
        );
    }

    #[test]
    fn discovers_each_splash_message_once() {
        let mut records = AchievementRecords::default();

        assert!(records.discover_splash_message(&identifier("rainbow-mode")));
        assert!(!records.discover_splash_message(&identifier("rainbow-mode")));
        assert!(records.discover_splash_message(&identifier("chosen-frame")));
        assert_eq!(records.discovered_splash_message_ids.len(), 2);
    }

    #[test]
    fn the_viewed_mark_only_moves_forward() {
        let mut records = AchievementRecords::default();

        assert!(records.mark_viewed(2_000));
        assert!(!records.mark_viewed(1_000));
        assert!(!records.mark_viewed(2_000));
        assert_eq!(records.viewed_at_millis, Some(2_000));
        assert!(records.mark_viewed(3_000));
        assert_eq!(records.viewed_at_millis, Some(3_000));
    }

    #[test]
    fn stops_recording_at_the_collection_limit() {
        let mut records = AchievementRecords::default();
        let achievements = (0..MAX_RECORDED_ENTRIES + 1)
            .map(|index| identifier(&format!("achievement-{index}")))
            .collect::<Vec<_>>();

        assert_eq!(records.unlock(&achievements, 1).len(), MAX_RECORDED_ENTRIES);
        for index in 0..MAX_RECORDED_ENTRIES {
            records.discover_splash_message(&identifier(&format!("message-{index}")));
        }
        assert!(!records.discover_splash_message(&identifier("one-too-many")));
    }

    #[test]
    fn round_trips_the_current_document_version() {
        let mut records = AchievementRecords::default();
        records.unlock(&[identifier("the-chosen-one")], 42);
        records.discover_splash_message(&identifier("frame-not-found"));
        let bytes = serde_json::to_vec(&StoredAchievementRecords::current(&records))
            .expect("records serialize");
        let document: Value = serde_json::from_slice(&bytes).expect("document is JSON");

        assert_eq!(document["version"], ACHIEVEMENTS_VERSION);
        assert_eq!(
            document["unlockedAchievements"]["the-chosen-one"]["unlockedAtMillis"],
            42
        );
        assert_eq!(document["discoveredSplashMessageIds"][0], "frame-not-found");
        assert_eq!(decode_achievement_records(&bytes), Ok(records));
    }

    #[test]
    fn migrates_version_1_milestones_to_their_equivalent_tiers() {
        let records = decode_achievement_records(
            br#"{
                "version": 1,
                "unlockedAchievements": {
                    "first-export": { "unlockedAtMillis": 100 },
                    "getting-started": { "unlockedAtMillis": 200 },
                    "export-veteran": { "unlockedAtMillis": 300 },
                    "export-legend": { "unlockedAtMillis": 400 },
                    "first-lossless-cut": { "unlockedAtMillis": 110 },
                    "lossless-legend": { "unlockedAtMillis": 410 },
                    "gif-maker": { "unlockedAtMillis": 120 },
                    "audio-specialist": { "unlockedAtMillis": 420 },
                    "one-hour-later": { "unlockedAtMillis": 130 },
                    "working-overtime": { "unlockedAtMillis": 430 },
                    "data-cruncher": { "unlockedAtMillis": 140 },
                    "storage-saver": { "unlockedAtMillis": 150 },
                    "the-chosen-one": { "unlockedAtMillis": 160 }
                },
                "discoveredSplashMessageIds": ["rainbow-mode"]
            }"#,
        )
        .expect("version 1 document migrates");

        let unlocked = records
            .unlocked_achievements
            .iter()
            .map(|(id, unlock)| (id.as_str(), unlock.unlocked_at_millis))
            .collect::<Vec<_>>();
        assert_eq!(
            unlocked,
            [
                ("data-cruncher-gold", 140),
                ("export-mastery-bronze", 100),
                ("export-mastery-gold", 300),
                ("export-mastery-silver", 200),
                ("gif-creator-bronze", 120),
                ("lossless-precision-bronze", 110),
                ("storage-saver-gold", 150),
                ("the-chosen-one", 160),
                ("time-well-spent-gold", 130),
            ]
        );
        assert_eq!(
            records.discovered_splash_message_ids,
            BTreeSet::from(["rainbow-mode".to_owned()])
        );
    }

    #[test]
    fn current_version_identifiers_are_not_migrated() {
        let records = decode_achievement_records(
            br#"{"version":2,"unlockedAchievements":{"storage-saver":{"unlockedAtMillis":1}}}"#,
        )
        .expect("current document decodes");
        assert!(records.unlocked_achievements.contains_key("storage-saver"));
    }

    #[test]
    fn missing_fields_of_a_known_version_default_to_empty() {
        let records = decode_achievement_records(
            br#"{"version":2,"discoveredSplashMessageIds":["rainbow-mode"]}"#,
        )
        .expect("partial document decodes");
        assert!(records.unlocked_achievements.is_empty());
        assert_eq!(
            records.discovered_splash_message_ids,
            BTreeSet::from(["rainbow-mode".to_owned()])
        );
    }

    #[test]
    fn rejects_invalid_and_unsupported_documents() {
        for invalid in [
            &b"not json"[..],
            br#"{"unlockedAchievements":{}}"#,
            br#"{"version":1,"unlockedAchievements":{"first-export":{"unlockedAtMillis":"soon"}}}"#,
            br#"{"version":2,"unlockedAchievements":{"../escape":{"unlockedAtMillis":1}}}"#,
            br#"{"version":2,"discoveredSplashMessageIds":["Not Valid"]}"#,
        ] {
            assert_eq!(
                decode_achievement_records(invalid),
                Err(AchievementsDecodeError::Invalid)
            );
        }
        assert_eq!(
            decode_achievement_records(br#"{"version":99}"#),
            Err(AchievementsDecodeError::UnsupportedVersion(99))
        );
    }
}
