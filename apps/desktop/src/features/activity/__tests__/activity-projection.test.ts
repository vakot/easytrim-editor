import { describe, expect, it } from "vitest";

import type { DiagnosticEvent, DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";

import {
  type ActivityProjectionLabels,
  getActivitySessionPresentation,
  groupActivityEntriesBySession,
  projectActivityEvent,
  projectActivityEvents,
  resolveAvailableActivityActions,
} from "../activity-projection";

const labels: ActivityProjectionLabels = {
  fastCutCompleted: "Fast cut completed",
  fileDeleted: "File deleted",
  fileRestored: "File restored",
  renderCompleted: "Optimized render completed",
};

const outputPath = "C:/Exports/clip.mp4";
const sourcePath = "C:/Media/source.mp4";
const sessionLabels = { now: "Now", today: "Today", yesterday: "Yesterday" };

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

function session(
  sessionId: string,
  startedAt: string,
  appVersion: string | null = "1.3.0",
): DiagnosticSessionMetadata {
  return { appVersion, sessionId, startedAt };
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

  it("combines retained and current sessions with stable identity and original timestamps", () => {
    const retained = diagnosticEvent("ffmpeg.export.completed", {
      data: { outputPath, outputType: "fast" },
      operationId: "retained-export",
      sessionId: "retained-session",
      timestamp: "2026-08-29T09:00:00.000Z",
    });

    const current = diagnosticEvent("ffmpeg.export.completed", {
      data: { outputPath, outputType: "optimized" },
      operationId: "current-export",
      sessionId: "current-session",
      timestamp: "2026-08-31T09:00:00.000Z",
    });

    const entries = projectActivityEvents(
      [retained, diagnosticEvent("preview.media.ready"), current, current],
      labels,
    );

    expect(entries).toMatchObject([
      {
        id: "retained-session:retained-export:ffmpeg.export.completed",
        sessionId: "retained-session",
        timestamp: "2026-08-29T09:00:00.000Z",
      },
      {
        id: "current-session:current-export:ffmpeg.export.completed",
        sessionId: "current-session",
        timestamp: "2026-08-31T09:00:00.000Z",
      },
    ]);
  });

  it("offers restore only for authoritative current-session state while preserving open", () => {
    const retainedDelete = projectActivityEvent(
      diagnosticEvent("source.file-delete.completed", {
        data: { itemId: "shared-target", sourcePath },
        operationId: "retained-delete",
        sessionId: "retained-session",
      }),
      labels,
    );

    const currentDelete = projectActivityEvent(
      diagnosticEvent("source.file-delete.completed", {
        data: { itemId: "shared-target", sourcePath },
        operationId: "current-delete",
        sessionId: "current-session",
      }),
      labels,
    );

    const retainedExport = projectActivityEvent(
      diagnosticEvent("ffmpeg.export.completed", {
        data: { outputPath, outputType: "fast" },
        operationId: "retained-export",
        sessionId: "retained-session",
      }),
      labels,
    );

    const entries = resolveAvailableActivityActions(
      [retainedDelete, currentDelete, retainedExport].filter((entry) => entry !== null),
      "current-session",
      new Set(["shared-target"]),
    );

    expect(entries[0]?.action).toBeUndefined();
    expect(entries[1]?.action).toEqual({
      kind: "restore",
      path: sourcePath,
      targetId: "shared-target",
    });
    expect(entries[2]?.action).toEqual({ kind: "open", path: outputPath });
  });

  it("groups by canonical session metadata with current and newest sessions first", () => {
    const currentOlder = projectActivityEvent(
      diagnosticEvent("source.file-restore.completed", {
        operationId: "current-older",
        sessionId: "current-session",
        timestamp: "2026-08-31T08:00:00Z",
      }),
      labels,
    );

    const currentNewer = projectActivityEvent(
      diagnosticEvent("source.file-delete.completed", {
        operationId: "current-newer",
        sessionId: "current-session",
        timestamp: "2026-09-01T00:14:00Z",
      }),
      labels,
    );

    const recentHistory = projectActivityEvent(
      diagnosticEvent("ffmpeg.export.completed", {
        data: { outputType: "fast" },
        operationId: "recent-history",
        sessionId: "recent-session",
        timestamp: "2026-08-31T20:00:00Z",
      }),
      labels,
    );

    const oldHistory = projectActivityEvent(
      diagnosticEvent("ffmpeg.export.completed", {
        data: { outputType: "optimized" },
        operationId: "old-history",
        sessionId: "old-session",
        timestamp: "2026-08-29T20:00:00Z",
      }),
      labels,
    );

    const groups = groupActivityEntriesBySession(
      [currentOlder, recentHistory, currentNewer, oldHistory].filter((entry) => entry !== null),
      [
        session("old-session", "2026-08-29T08:00:00Z"),
        session("current-session", "2026-08-30T23:52:00Z"),
        session("recent-session", "2026-08-31T11:52:00Z"),
        session("empty-session", "2026-08-31T12:52:00Z"),
      ],
      "current-session",
    );

    expect(groups.map((group) => group.sessionId)).toEqual([
      "current-session",
      "recent-session",
      "old-session",
    ]);
    expect(groups[0]).toMatchObject({
      isCurrent: true,
      startedAt: "2026-08-30T23:52:00Z",
    });
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual([
      currentNewer?.id,
      currentOlder?.id,
    ]);
    expect(groups).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: "empty-session" })]),
    );
  });

  it.each([
    ["2026-08-31T12:34:00", "Today · 12:34 PM"],
    ["2026-08-30T20:14:00", "Yesterday · 8:14 PM"],
    ["2026-08-29T10:03:00", "Aug 29 · 10:03 AM"],
    ["2025-12-28T21:21:00", "Dec 28, 2025 · 9:21 PM"],
  ])("formats historical session start %s from metadata", (startedAt, expected) => {
    const group = {
      ...session("history-session", startedAt),
      entries: [],
      isCurrent: false,
    };

    expect(
      getActivitySessionPresentation(
        group,
        "1.3.0",
        new Date("2026-08-31T18:00:00"),
        "en-US",
        sessionLabels,
      ),
    ).toEqual({ label: expected, tone: "default" });
  });

  it("labels the current session as Now", () => {
    const group = {
      ...session("current-session", "2026-08-31T12:34:00"),
      entries: [],
      isCurrent: true,
    };

    expect(
      getActivitySessionPresentation(
        group,
        "1.3.0",
        new Date("2026-08-31T18:00:00"),
        "en-US",
        sessionLabels,
      ),
    ).toEqual({ label: "Now", tone: "current" });
  });

  it("omits the current session when it has no projected activity", () => {
    expect(
      groupActivityEntriesBySession(
        [],
        [session("current-session", "2026-08-31T12:34:00")],
        "current-session",
      ),
    ).toEqual([]);
  });

  it("warns only for a different known version and prefixes its label", () => {
    const differentVersion = {
      ...session("different-session", "2026-08-30T20:14:00", "1.4.2"),
      entries: [],
      isCurrent: false,
    };

    const unknownVersion = {
      ...session("unknown-session", "2026-08-30T20:14:00", null),
      entries: [],
      isCurrent: false,
    };

    expect(
      getActivitySessionPresentation(
        differentVersion,
        "1.3.0",
        new Date("2026-08-31T18:00:00"),
        "en-US",
        sessionLabels,
      ),
    ).toEqual({ label: "v1.4.2 · Yesterday · 8:14 PM", tone: "warning" });
    expect(
      getActivitySessionPresentation(
        unknownVersion,
        "1.3.0",
        new Date("2026-08-31T18:00:00"),
        "en-US",
        sessionLabels,
      ).tone,
    ).toBe("default");
  });
});
