use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Schema version written to the statistics document. Bump it together with a migration arm in
/// [`decode_usage_statistics`] whenever the stored shape changes incompatibly.
pub const USAGE_STATISTICS_VERSION: u64 = 1;

/// The export route of a completed export, for the per-route breakdown.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExportKind {
    /// Optimized Export, which re-encodes the video.
    Optimized,
    /// Fast Export, which always stream-copies the video.
    Lossless,
    /// GIF export.
    Gif,
    /// Audio-only export.
    Audio,
}

/// Measured file sizes of one export. The two are only ever recorded together, so
/// `source_bytes - output_bytes` stays meaningful across the cumulative totals.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExportDataSizes {
    /// Size of the export's source file. Each export counts its whole source once.
    pub source_bytes: u64,
    /// Size of the verified output file.
    pub output_bytes: u64,
}

/// One successful export operation, measured by the native export command.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CompletedExport {
    pub kind: ExportKind,
    /// Wall-clock time the FFmpeg process ran; queue waiting is never part of it.
    pub processing_millis: u64,
    /// `None` when the source file could not be measured: the export is still counted, but it
    /// contributes to neither byte total rather than recording a guessed or zero size.
    pub data: Option<ExportDataSizes>,
    /// Unix epoch milliseconds when the export completed.
    pub completed_at_millis: i64,
}

/// Raw cumulative statistics across application sessions. Derived values such as the completed
/// export total and storage saved are computed by consumers, not stored.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct UsageStatistics {
    pub optimized_exports: u64,
    pub lossless_exports: u64,
    pub gif_exports: u64,
    pub audio_exports: u64,
    pub processing_millis: u64,
    pub source_bytes: u64,
    pub output_bytes: u64,
    pub first_export_at_millis: Option<i64>,
    pub last_export_at_millis: Option<i64>,
}

impl UsageStatistics {
    pub fn record(&mut self, export: &CompletedExport) {
        let count = match export.kind {
            ExportKind::Optimized => &mut self.optimized_exports,
            ExportKind::Lossless => &mut self.lossless_exports,
            ExportKind::Gif => &mut self.gif_exports,
            ExportKind::Audio => &mut self.audio_exports,
        };
        *count = count.saturating_add(1);
        self.processing_millis = self
            .processing_millis
            .saturating_add(export.processing_millis);
        if let Some(data) = &export.data {
            self.source_bytes = self.source_bytes.saturating_add(data.source_bytes);
            self.output_bytes = self.output_bytes.saturating_add(data.output_bytes);
        }
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
            data: Some(ExportDataSizes {
                source_bytes: 1_000,
                output_bytes: 400,
            }),
            completed_at_millis,
        }
    }

    #[test]
    fn records_each_completed_export_into_the_totals() {
        let mut statistics = UsageStatistics::default();
        statistics.record(&export(ExportKind::Lossless, 2_000));
        statistics.record(&export(ExportKind::Optimized, 3_000));
        statistics.record(&export(ExportKind::Gif, 2_500));
        statistics.record(&export(ExportKind::Audio, 2_500));
        statistics.record(&CompletedExport {
            data: Some(ExportDataSizes {
                source_bytes: 1_000,
                output_bytes: 5_000,
            }),
            ..export(ExportKind::Optimized, 1_000)
        });

        assert_eq!(
            statistics,
            UsageStatistics {
                optimized_exports: 2,
                lossless_exports: 1,
                gif_exports: 1,
                audio_exports: 1,
                processing_millis: 7_500,
                source_bytes: 5_000,
                output_bytes: 6_600,
                first_export_at_millis: Some(1_000),
                last_export_at_millis: Some(3_000),
            }
        );
    }

    #[test]
    fn unmeasured_source_counts_the_export_but_no_data() {
        let mut statistics = UsageStatistics::default();
        statistics.record(&export(ExportKind::Lossless, 1_000));
        statistics.record(&CompletedExport {
            data: None,
            ..export(ExportKind::Lossless, 2_000)
        });

        assert_eq!(statistics.lossless_exports, 2);
        assert_eq!(statistics.processing_millis, 3_000);
        assert_eq!(statistics.source_bytes, 1_000);
        assert_eq!(statistics.output_bytes, 400);
        assert_eq!(statistics.last_export_at_millis, Some(2_000));
    }

    #[test]
    fn totals_saturate_instead_of_overflowing() {
        let mut statistics = UsageStatistics {
            source_bytes: u64::MAX - 1,
            ..UsageStatistics::default()
        };
        statistics.record(&export(ExportKind::Optimized, 1));
        assert_eq!(statistics.source_bytes, u64::MAX);
    }

    #[test]
    fn round_trips_the_current_document_version() {
        let statistics = UsageStatistics {
            optimized_exports: 3,
            first_export_at_millis: Some(10),
            ..UsageStatistics::default()
        };
        let bytes = serde_json::to_vec(&StoredUsageStatistics::current(&statistics))
            .expect("statistics serialize");
        let document: Value = serde_json::from_slice(&bytes).expect("document is JSON");

        assert_eq!(document["version"], USAGE_STATISTICS_VERSION);
        assert_eq!(document["optimizedExports"], 3);
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
            decode_usage_statistics(br#"{"optimizedExports":1}"#),
            Err(StatisticsDecodeError::Invalid)
        );
        assert_eq!(
            decode_usage_statistics(br#"{"version":1,"optimizedExports":-1}"#),
            Err(StatisticsDecodeError::Invalid)
        );
        assert_eq!(
            decode_usage_statistics(br#"{"version":99}"#),
            Err(StatisticsDecodeError::UnsupportedVersion(99))
        );
    }
}
