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
  if (micros === undefined) return unknownLabel;

  const updatedAtMs = micros / 1_000;
  const elapsedSeconds = Math.floor((nowMs - updatedAtMs) / 1_000);
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(updatedAtMs)) return unknownLabel;

  if (elapsedSeconds < 0) return formatDateOnly(updatedAtMs, locale, unknownLabel);

  const relativeTimeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (elapsedSeconds < 60) {
    return relativeTimeFormatter.format(-Math.max(1, elapsedSeconds), "second");
  }
  if (elapsedSeconds < 3_600) {
    return relativeTimeFormatter.format(-Math.floor(elapsedSeconds / 60), "minute");
  }
  if (elapsedSeconds < 86_400) {
    return relativeTimeFormatter.format(-Math.floor(elapsedSeconds / 3_600), "hour");
  }

  const updatedAt = new Date(updatedAtMs);
  const now = new Date(nowMs);
  if (isYesterday(updatedAt, now)) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  }

  return formatDateOnly(updatedAtMs, locale, unknownLabel);
}

function formatDateOnly(ms: number, locale: string, unknownLabel: string): string {
  const date = new Date(ms);
  return Number.isNaN(date.getTime())
    ? unknownLabel
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

export { formatDateTime, formatRelativeTime };
