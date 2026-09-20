import type { TrimRange } from "@/domain/trim";

export const EMPTY_TIMELINE_RANGE: TrimRange = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
};
