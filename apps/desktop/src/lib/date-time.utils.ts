function formatDateTime(micros: number | undefined, locale: string, unknownLabel: string): string {
  if (micros === undefined) return unknownLabel;

  const date = new Date(micros / 1_000);
  return Number.isNaN(date.getTime())
    ? unknownLabel
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatRelativeTime(
  micros: number | undefined,
  locale: string,
  unknownLabel: string,
  nowMs = Date.now(),
): string {
  const bucket = getRelativeTimeBucket(micros, nowMs);
  if (bucket.kind === "unknown") return unknownLabel;
  if (bucket.kind === "date") return formatDateOnly(bucket.timestampMs, locale, unknownLabel);
  if (bucket.kind === "yesterday") {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
    -bucket.value,
    bucket.unit,
  );
}

type RelativeTimeBucket =
  | { kind: "date"; timestampMs: number }
  | { kind: "relative"; unit: "hour" | "minute" | "second"; value: number }
  | { kind: "unknown" }
  | { kind: "yesterday" };

function getRelativeTimeBucket(micros: number | undefined, nowMs = Date.now()): RelativeTimeBucket {
  if (micros === undefined) return { kind: "unknown" };

  const timestampMs = micros / 1_000;
  const elapsedSeconds = Math.floor((nowMs - timestampMs) / 1_000);
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(timestampMs)) return { kind: "unknown" };

  if (elapsedSeconds < 0 || elapsedSeconds >= 172_800) return { kind: "date", timestampMs };
  if (elapsedSeconds < 60) {
    return { kind: "relative", unit: "second", value: Math.max(1, elapsedSeconds) };
  }
  if (elapsedSeconds < 3_600) {
    return { kind: "relative", unit: "minute", value: Math.floor(elapsedSeconds / 60) };
  }
  if (elapsedSeconds < 86_400) {
    return { kind: "relative", unit: "hour", value: Math.floor(elapsedSeconds / 3_600) };
  }

  return { kind: "yesterday" };
}

function getRelativeTimeBucketKey(micros: number | undefined, nowMs = Date.now()): string {
  const bucket = getRelativeTimeBucket(micros, nowMs);
  if (bucket.kind === "unknown") return "unknown";
  if (bucket.kind === "yesterday") return "yesterday";
  if (bucket.kind === "date") {
    const date = new Date(bucket.timestampMs);
    return `date:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  return `relative:${bucket.unit}:${bucket.value}`;
}

function formatDateOnly(ms: number, locale: string, unknownLabel: string): string {
  const date = new Date(ms);
  return Number.isNaN(date.getTime())
    ? unknownLabel
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export { formatDateTime, formatRelativeTime, getRelativeTimeBucketKey };
