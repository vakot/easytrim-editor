# Usage statistics

EasyTrim keeps cumulative, local-only statistics about successful exports and shows them in the
Statistics dialog. Nothing is sent anywhere: there is no telemetry, account, or remote storage.
The statistics are designed as the raw input for a future Achievements profile.

## Ownership

Rust owns collection, aggregation, and persistence. The single successful-completion point of a
native export command records one `CompletedExport` into the managed `StatisticsStore`, and only
after FFmpeg exited successfully, the operation was not cancelled, and the output file was verified
as present and non-empty. Failed, cancelled, interrupted, and merely queued work never reaches it.

The frontend never counts anything. `get_usage_statistics` returns the stored totals; the
`usageStatistics` Redux slice is a runtime mirror that a listener refreshes after every
`editingInstanceExportCompleted` action. Because the native command records before it reports
success, the refresh observes the new totals. Formatting lives with the Statistics dialog; derived
values live in `domain/usage-statistics.ts`.

## Accounting rules

| Metric                | Rule                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Completed Exports     | Optimized Exports + Lossless Cuts + GIF Exports + Audio Exports.                                                               |
| Optimized Exports     | Successful Optimized Exports, which re-encode the video.                                                                       |
| Lossless Cuts         | Successful Fast Exports, which always stream-copy the video; audio may still be re-encoded when tracks are merged or filtered. |
| GIF Exports           | Successful GIF exports.                                                                                                        |
| Audio Exports         | Successful audio-only exports.                                                                                                 |
| Processing Time       | Wall-clock run time of the FFmpeg process; queue waiting happens before the native command starts.                             |
| Source Data Processed | Source file size read when the export starts, counted once per completed export.                                               |
| Output Data Generated | Verified output file size read from filesystem metadata after FFmpeg exits.                                                    |
| Storage Saved         | Source Data Processed − Output Data Generated; negative when outputs are larger.                                               |
| First / Last Export   | Completion times (Unix milliseconds) of the earliest and latest recorded exports.                                              |

Each export route has its own count, so the route counts never overlap. Every export has exactly one
source and one output, so these rules need no multi-file weighting.
A source exported three times contributes its size three times.
Sizes and durations are measured, never estimated from media metadata. Existing queue history is
not backfilled because its sizes and completion cannot be verified after the fact.

## Double-count protection

Each native export command invocation records at most once, at its end. Queue retries, requeues
after a source-level stop, and restored attempts start a new native operation, so only an
operation that actually succeeds is counted. Duplicate or stale frontend completion actions only
trigger a read. A crash after FFmpeg succeeds but before the statistics write loses that one
export rather than counting it twice.

## Persistence

The document is `<app data>/statistics/usage-statistics.json`:

```json
{
  "version": 1,
  "optimizedExports": 0,
  "losslessExports": 0,
  "gifExports": 0,
  "audioExports": 0,
  "processingMillis": 0,
  "sourceBytes": 0,
  "outputBytes": 0,
  "firstExportAtMillis": null,
  "lastExportAtMillis": null
}
```

- **Crash safety:** each update is written to a synced temporary file and atomically replaces the
  document, using the same helper as diagnostics.
- **Serialized updates:** one mutex covers the in-memory update and its file write, so concurrent
  completions cannot overwrite each other.
- **Defaults:** a missing file starts from zero; fields missing from a known version default to
  zero.
- **Migration:** `decode_usage_statistics` dispatches on `version`. A future schema adds a
  migration arm for older versions and bumps `USAGE_STATISTICS_VERSION`.
- **Recovery:** an invalid document, or one written by a newer version, is renamed aside to
  `usage-statistics.<timestamp>.<reason>.json` and counting restarts from zero. If the file cannot
  be read or moved aside, it is left untouched and the session counts in memory only. Load and
  write problems are recorded as `statistics.*` diagnostic events without paths.
- **Write failures:** the in-memory totals still include the export, and the next successful write
  persists the cumulative state.

Statistics survive application restarts and workspace resets and are independent of editing
instances and the Export Queue.
