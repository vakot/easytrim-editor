import { describe, expect, it } from "vitest";

import type { DiagnosticEvent } from "@/lib/tauri/diagnostics.types";

import {
  type ActivityProjectionLabels,
  groupActivityEntries,
  projectActivityEvent,
  projectActivityEvents,
} from "../activity-projection";

const labels: ActivityProjectionLabels = {
  fastCutCompleted: "Fast cut completed",
  fileDeleted: "File deleted",
  fileRestored: "File restored",
  renderCompleted: "Optimized render completed",
};

function diagnosticEvent(
  event: DiagnosticEvent["event"],
  overrides: Partial<DiagnosticEvent> = {},
): DiagnosticEvent {
  return {
    category: event.split(".")[0] ?? "test",
    event,
    level: "info",
    operationId: "operation-1",
    result: "success",
    sessionId: "session-1",
    timestamp: "2026-08-31T09:00:00.000Z",
    ...overrides,
  };
}

describe("activity projection", () => {
  it.each([
    ["fast", "fast-cut-completed", "Fast cut completed"],
    ["optimized", "render-completed", "Optimized render completed"],
  ] as const)("projects a completed %s export", (outputType, kind, title) => {
    const entry = projectActivityEvent(
      diagnosticEvent("ffmpeg.export.completed", { data: { outputType } }),
      labels,
    );

    expect(entry).toMatchObject({
      kind,
      sessionId: "session-1",
      timestamp: "2026-08-31T09:00:00.000Z",
      title,
    });
  });

  it.each([
    ["source.file-delete.completed", "file-deleted", "File deleted"],
    ["source.file-restore.completed", "file-restored", "File restored"],
  ] as const)("projects %s with its semantic activity kind", (event, kind, title) => {
    expect(projectActivityEvent(diagnosticEvent(event), labels)).toMatchObject({ kind, title });
  });

  it.each([
    "timeline.controls.locked",
    "waveform.generate.started",
    "ffmpeg.progress.reported",
    "preview.media.ready",
  ] as const)("ignores diagnostic-only event %s", (event) => {
    expect(projectActivityEvent(diagnosticEvent(event), labels)).toBeNull();
  });

  it("ignores the native export completion that has no UI route semantics", () => {
    expect(projectActivityEvent(diagnosticEvent("ffmpeg.export.completed"), labels)).toBeNull();
  });

  it("deduplicates repeated diagnostics and ignores unrelated events", () => {
    const completed = diagnosticEvent("source.file-delete.completed");
    expect(
      projectActivityEvents(
        [completed, diagnosticEvent("timeline.seek.completed"), completed],
        labels,
      ),
    ).toHaveLength(1);
  });

  it("groups by local calendar date and orders groups and entries newest first", () => {
    const newest = projectActivityEvent(
      diagnosticEvent("source.file-restore.completed", {
        operationId: "operation-3",
        timestamp: new Date(2026, 7, 31, 18).toISOString(),
      }),
      labels,
    );

    const sameDayOlder = projectActivityEvent(
      diagnosticEvent("source.file-delete.completed", {
        operationId: "operation-2",
        timestamp: new Date(2026, 7, 31, 8).toISOString(),
      }),
      labels,
    );

    const previousDay = projectActivityEvent(
      diagnosticEvent("ffmpeg.export.completed", {
        data: { outputType: "fast" },
        operationId: "operation-1",
        timestamp: new Date(2026, 7, 30, 20).toISOString(),
      }),
      labels,
    );

    const groups = groupActivityEntries(
      [sameDayOlder, previousDay, newest].filter((entry) => entry !== null),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual([newest?.id, sameDayOlder?.id]);
    expect(groups[1]?.entries.map((entry) => entry.id)).toEqual([previousDay?.id]);
  });
});
