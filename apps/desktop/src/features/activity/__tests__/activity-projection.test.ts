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

const outputPath = "C:/Exports/clip.mp4";
const sourcePath = "C:/Media/source.mp4";

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
      diagnosticEvent("ffmpeg.export.completed", { data: { outputPath, outputType } }),
      labels,
    );

    expect(entry).toMatchObject({
      action: { kind: "open", path: outputPath },
      kind,
      path: outputPath,
      sessionId: "session-1",
      timestamp: "2026-08-31T09:00:00.000Z",
      title,
    });
  });

  it("projects a deleted file with its path and restore target", () => {
    expect(
      projectActivityEvent(
        diagnosticEvent("source.file-delete.completed", {
          data: { itemId: "export-1", sourcePath },
        }),
        labels,
      ),
    ).toMatchObject({
      action: { kind: "restore", path: sourcePath, targetId: "export-1" },
      kind: "file-deleted",
      path: sourcePath,
      title: "File deleted",
    });
  });

  it("projects a restored file with its path and no action", () => {
    const entry = projectActivityEvent(
      diagnosticEvent("source.file-restore.completed", { data: { sourcePath } }),
      labels,
    );

    expect(entry).toMatchObject({
      kind: "file-restored",
      path: sourcePath,
      title: "File restored",
    });
    expect(entry?.action).toBeUndefined();
  });

  it.each([
    ["ffmpeg.export.completed", { outputType: "fast" }],
    ["source.file-delete.completed", { itemId: "export-1" }],
    ["source.file-delete.completed", { sourcePath }],
  ] as const)("does not create an invalid action for %s without required data", (event, data) => {
    expect(projectActivityEvent(diagnosticEvent(event, { data }), labels)?.action).toBeUndefined();
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
