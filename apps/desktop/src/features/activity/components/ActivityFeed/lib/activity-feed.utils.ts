function toTimestampMicros(timestamp: string): number | undefined {
  const timestampMs = Date.parse(timestamp);
  return Number.isNaN(timestampMs) ? undefined : timestampMs * 1_000;
}

export { toTimestampMicros };
