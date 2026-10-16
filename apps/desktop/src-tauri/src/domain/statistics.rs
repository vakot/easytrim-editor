use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Schema version written to the statistics document. Bump it together with a migration arm in
/// [`decode_usage_statistics`] whenever the stored shape changes incompatibly.
pub const USAGE_STATISTICS_VERSION: u64 = 1;

/// How a completed export was produced, for the regular/lossless breakdown.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExportKind {
    /// Re-encoded output: Optimized, GIF, and audio exports.
    Regular,
    /// Fast Export, which always stream-copies the video.
    Lossless,
}

/// One successful export operation, measured by the native export command.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CompletedExport {
    pub kind: ExportKind,
    /// Wall-clock time the FFmpeg process ran; queue waiting is never part of it.
    pub processing_millis: u64,
    /// Size of the export's source file. Each export counts its whole source once.
    pub source_bytes: u64,
    /// Size of the verified output file.
    pub output_bytes: u64,
    /// Unix epoch milliseconds when the export completed.
    pub completed_at_millis: i64,
}

/// Raw cumulative statistics across application sessions. Derived values such as the completed
/// export total and storage saved are computed by consumers, not stored.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct UsageStatistics {
    pub regular_exports: u64,
    pub lossless_exports: u64,
    pub processing_millis: u64,
    pub source_bytes: u64,
    pub output_bytes: u64,
    pub first_export_at_millis: Option<i64>,
    pub last_export_at_millis: Option<i64>,
}

impl UsageStatistics {
    pub fn record(&mut self, export: &CompletedExport) {
        match export.kind {
            ExportKind::Regular => self.regular_exports = self.regular_exports.saturating_add(1),
            ExportKind::Lossless => {
                self.lossless_exports = self.lossless_exports.saturating_add(1);
            }
        }
        self.processing_millis = self
            .processing_millis
            .saturating_add(export.processing_millis);
        self.source_bytes = self.source_bytes.saturating_add(export.source_bytes);
        self.output_bytes = self.output_bytes.saturating_add(export.output_bytes);
        let completed_at = export.completed_at_millis;
        self.first_export_at_millis = Some(
            self.first_export_at_millis
                .map_or(completed_at, |first| first.min(completed_at)),
        );
        self.last_export_at_millis = Some(
            self.last_export_at_millis
                .map_or(completed_at, |last| last.max(completed_at)),
        );
    }
}

/// The on-disk document: the current schema version followed by the statistics fields.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredUsageStatistics {
    version: u64,
    #[serde(flatten)]
    statistics: UsageStatistics,
}

impl StoredUsageStatistics {
    pub fn current(statistics: &UsageStatistics) -> Self {
        Self {
            version: USAGE_STATISTICS_VERSION,
            statistics: statistics.clone(),
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum StatisticsDecodeError {
    /// The document is not JSON, has no numeric version, or has invalid field values.
    Invalid,
    /// The document was written by a newer or unknown schema version.
    UnsupportedVersion(u64),
}

/// Decodes a stored statistics document, migrating older schema versions to the current shape.
/// Fields missing from a known version take their zero defaults.
pub fn decode_usage_statistics(bytes: &[u8]) -> Result<UsageStatistics, StatisticsDecodeError> {
    let document: Value =
        serde_json::from_slice(bytes).map_err(|_| StatisticsDecodeError::Invalid)?;
    let version = document
        .get("version")
        .and_then(Value::as_u64)
        .ok_or(StatisticsDecodeError::Invalid)?;
    match version {
        USAGE_STATISTICS_VERSION => serde_json::from_value::<StoredUsageStatistics>(document)
            .map(|stored| stored.statistics)
            .map_err(|_| StatisticsDecodeError::Invalid),
        other => Err(StatisticsDecodeError::UnsupportedVersion(other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn export(kind: ExportKind, completed_at_millis: i64) -> CompletedExport {
        CompletedExport {
            kind,
            processing_millis: 1_500,
            source_bytes: 1_000,
            output_bytes: 400,
            completed_at_millis,
        }
    }

    #[test]
    fn records_each_completed_export_into_the_totals() {
        let mut statistics = UsageStatistics::default();
        statistics.record(&export(ExportKind::Lossless, 2_000));
        statistics.record(&export(ExportKind::Regular, 3_000));
        statistics.record(&CompletedExport {
            output_bytes: 5_000,
            ..export(ExportKind::Regular, 1_000)
        });

        assert_eq!(
            statistics,
            UsageStatistics {
                regular_exports: 2,
                lossless_exports: 1,
                processing_millis: 4_500,
                source_bytes: 3_000,
                output_bytes: 5_800,
                first_export_at_millis: Some(1_000),
                last_export_at_millis: Some(3_000),
            }
        );
    }

    #[test]
    fn totals_saturate_instead_of_overflowing() {
        let mut statistics = UsageStatistics {
            source_bytes: u64::MAX - 1,
            ..UsageStatistics::default()
        };
        statistics.record(&export(ExportKind::Regular, 1));
        assert_eq!(statistics.source_bytes, u64::MAX);
    }

    #[test]
    fn round_trips_the_current_document_version() {
        let statistics = UsageStatistics {
            regular_exports: 3,
            first_export_at_millis: Some(10),
            ..UsageStatistics::default()
        };
        let bytes = serde_json::to_vec(&StoredUsageStatistics::current(&statistics))
            .expect("statistics serialize");
        let document: Value = serde_json::from_slice(&bytes).expect("document is JSON");

        assert_eq!(document["version"], USAGE_STATISTICS_VERSION);
        assert_eq!(document["regularExports"], 3);
        assert_eq!(decode_usage_statistics(&bytes), Ok(statistics));
    }

    #[test]
    fn missing_fields_of_a_known_version_default_to_zero() {
        let statistics = decode_usage_statistics(br#"{"version":1,"losslessExports":2}"#)
            .expect("partial document decodes");
        assert_eq!(
            statistics,
            UsageStatistics {
                lossless_exports: 2,
                ..UsageStatistics::default()
            }
        );
    }

    #[test]
    fn rejects_invalid_and_unsupported_documents() {
        assert_eq!(
            decode_usage_statistics(b"not json"),
            Err(StatisticsDecodeError::Invalid)
        );
        assert_eq!(
            decode_usage_statistics(br#"{"regularExports":1}"#),
            Err(StatisticsDecodeError::Invalid)
        );
        assert_eq!(
            decode_usage_statistics(br#"{"version":1,"regularExports":-1}"#),
            Err(StatisticsDecodeError::Invalid)
        );
        assert_eq!(
            decode_usage_statistics(br#"{"version":99}"#),
            Err(StatisticsDecodeError::UnsupportedVersion(99))
        );
    }
}
