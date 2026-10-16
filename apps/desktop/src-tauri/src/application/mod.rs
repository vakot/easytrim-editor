use time::OffsetDateTime;

pub mod queue;
pub mod source;
pub mod statistics;

/// The current time as Unix epoch milliseconds, the timestamp unit of persisted application data.
pub fn unix_millis_now() -> i64 {
    let nanos = OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000;
    i64::try_from(nanos).unwrap_or(i64::MAX)
}
