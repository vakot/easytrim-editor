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
  fastCutCancelled: "Fast cut cancelled",
  fastCutCompleted: "Fast cut completed",
  fastCutFailed: "Fast cut failed",
  fastCutInterrupted: "Fast cut interrupted",
  fastCutting: "Fast cutting…",
  fileDeleteCancelled: "File deletion cancelled",
  fileDeleteFailed: "File deletion failed",
  fileDeleteInterrupted: "File deletion interrupted",
  fileDeleting: "Deleting file...",
  fileDeleted: "File deleted",
  fileRestoreCancelled: "File restoration cancelled",
  fileRestoreFailed: "File restoration failed",
  fileRestoreInterrupted: "File restoration interrupted",
  fileRestoring: "Restoring file...",
  fileRestored: "File restored",
  importOpenedFiles: (count) => `Opened ${count} file${count === 1 ? "" : "s"}`,
  importOpenedFilesFromFolders: (fileCount, folderCount) =>
    `Opened ${fileCount} file${fileCount === 1 ? "" : "s"} from ${folderCount} folder${folderCount === 1 ? "" : "s"}`,
  renderCancelled: "Render cancelled",
  renderCompleted: "Optimized render completed",
  renderFailed: "Render failed",
  renderInterrupted: "Render interrupted",
  rendering: "Rendering…",
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
  it("projects one completed file import from its correlated diagnostics", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("source.import.started", {
          operationId: "import-1",
          timestamp: "2026-08-31T08:59:00.000Z",
          data: { directFileCount: 1, folderCount: 0 },
        }),
        diagnosticEvent("source.import.requested", {
          operationId: "import-1",
          data: { directFileCount: 1, folderCount: 0 },
        }),
        diagnosticEvent("source.import.completed", {
          operationId: "import-1",
          data: {
            acceptedFileCount: 1,
            directFileCount: 1,
            discoveredFileCount: 0,
            folderCount: 0,
          },
        }),
      ],
      labels,
      "session-1",
    );

    expect(entries).toEqual([
      expect.objectContaining({
        id: "session-1:import-1:source.import",
        kind: "files-imported",
        operationId: "import-1",
        startedAt: "2026-08-31T08:59:00.000Z",
        status: "completed",
        title: "Opened 1 file",
      }),
    ]);
  });

  it("uses one folder entry and folder wording for mixed imports", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("source.import.started", {
          operationId: "import-2",
          timestamp: "2026-08-31T08:59:00.000Z",
        }),
        diagnosticEvent("source.import.completed", {
          operationId: "import-2",
          data: { acceptedFileCount: 3, folderCount: 1 },
        }),
      ],
      labels,
      "session-1",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "folders-imported",
      title: "Opened 3 files from 1 folder",
    });
  });

  it("does not project an import start as a pending Activity entry", () => {
    expect(
      projectActivityEvents(
        [diagnosticEvent("source.import.started", { operationId: "import-pending" })],
        labels,
        "session-1",
      ),
    ).toEqual([]);
  });

  it.each([
    ["fast", "fast-cut", "Fast cut completed"],
    ["optimized", "render", "Optimized render completed"],
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
      startedAt: "2026-08-31T09:00:00.000Z",
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

  it("projects a file deletion as pending and updates it in place on completion", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("source.file-delete.started", {
          data: { itemId: "delete-1", sourcePath },
          operationId: "delete-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T08:00:00.000Z",
        }),
        diagnosticEvent("source.file-delete.completed", {
          data: { itemId: "delete-1", sourcePath },
          operationId: "delete-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T08:01:00.000Z",
        }),
      ],
      labels,
      "current-session",
    );

    expect(entries).toEqual([
      expect.objectContaining({
        action: { kind: "restore", path: sourcePath, targetId: "delete-1" },
        id: "current-session:delete-1:source.file-delete",
        operationId: "delete-1",
        startedAt: "2026-08-31T08:00:00.000Z",
        status: "completed",
        title: "File deleted",
      }),
    ]);
  });

  it.each([
    ["failed", "File deletion failed"],
    ["cancelled", "File deletion cancelled"],
  ] as const)("projects a pending file deletion as %s", (terminal, title) => {
    const entry = projectActivityEvents(
      [
        diagnosticEvent("source.file-delete.started", {
          data: { itemId: "delete-1", sourcePath },
          operationId: "delete-1",
          sessionId: "current-session",
        }),
        diagnosticEvent(`source.file-delete.${terminal}`, {
          operationId: "delete-1",
          sessionId: "current-session",
        }),
      ],
      labels,
      "current-session",
    )[0];

    expect(entry).toMatchObject({ status: terminal, title });
    expect(entry?.action).toBeUndefined();
  });

  it("projects restore lifecycle and retains start ordering across concurrent operations", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("source.file-restore.started", {
          data: { itemId: "restore-1", sourcePath },
          operationId: "restore-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T08:00:00.000Z",
        }),
        diagnosticEvent("source.file-delete.started", {
          data: { itemId: "delete-1", sourcePath },
          operationId: "delete-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T08:01:00.000Z",
        }),
        diagnosticEvent("source.file-restore.completed", {
          data: { itemId: "restore-1", sourcePath },
          operationId: "restore-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T08:02:00.000Z",
        }),
      ],
      labels,
      "current-session",
    );

    expect(entries.map((entry) => [entry.id, entry.status, entry.startedAt])).toEqual([
      ["current-session:restore-1:source.file-restore", "completed", "2026-08-31T08:00:00.000Z"],
      ["current-session:delete-1:source.file-delete", "pending", "2026-08-31T08:01:00.000Z"],
    ]);
  });

  it.each([
    ["pending", "Restoring file..."],
    ["failed", "File restoration failed"],
    ["cancelled", "File restoration cancelled"],
  ] as const)("projects file restoration as %s", (status, title) => {
    const events = [
      diagnosticEvent("source.file-restore.started", {
        data: { sourcePath },
        operationId: "restore-1",
        sessionId: "current-session",
      }),
      ...(status === "pending"
        ? []
        : [
            diagnosticEvent(`source.file-restore.${status}`, {
              operationId: "restore-1",
              sessionId: "current-session",
            }),
          ]),
    ];

    const entry = projectActivityEvents(events, labels, "current-session")[0];

    expect(entry).toMatchObject({ operationId: "restore-1", status, title });
    expect(entry?.action).toBeUndefined();
  });

  it("marks historical unterminated file operations as interrupted", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("source.file-delete.started", {
          data: { itemId: "delete-1", sourcePath },
          operationId: "delete-1",
          sessionId: "history-session",
        }),
        diagnosticEvent("source.file-restore.started", {
          data: { itemId: "restore-1", sourcePath },
          operationId: "restore-1",
          sessionId: "history-session",
        }),
      ],
      labels,
      "current-session",
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationId: "delete-1", status: "interrupted" }),
        expect.objectContaining({ operationId: "restore-1", status: "interrupted" }),
      ]),
    );
    expect(entries.every((entry) => entry.action === undefined)).toBe(true);
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

  it("projects a current export start as one pending entry with its output path", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("ffmpeg.export.started", {
          data: { outputPath, outputType: "optimized" },
          operationId: "render-1",
          sessionId: "current-session",
        }),
      ],
      labels,
      "current-session",
    );

    expect(entries).toEqual([
      expect.objectContaining({
        id: "current-session:render-1:ffmpeg.export",
        operationId: "render-1",
        path: outputPath,
        startedAt: "2026-08-31T09:00:00.000Z",
        status: "pending",
        title: "Rendering…",
      }),
    ]);
    expect(entries[0]?.action).toBeUndefined();
  });

  it.each([
    ["ffmpeg.export.completed", "completed", "Optimized render completed", true],
    ["ffmpeg.export.failed", "failed", "Render failed", false],
    ["ffmpeg.export.cancelled", "cancelled", "Render cancelled", false],
  ] as const)("replaces a started export with %s", (event, status, title, hasOpenAction) => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("ffmpeg.export.started", {
          data: { outputPath, outputType: "optimized" },
          operationId: "render-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T08:30:00.000Z",
        }),
        diagnosticEvent(event, {
          data: event === "ffmpeg.export.completed" ? { outputPath, outputType: "optimized" } : {},
          operationId: "render-1",
          sessionId: "current-session",
          timestamp: "2026-08-31T09:00:00.000Z",
        }),
      ],
      labels,
      "current-session",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "current-session:render-1:ffmpeg.export",
      startedAt: "2026-08-31T08:30:00.000Z",
      status,
      title,
    });
    expect(Boolean(entries[0]?.action)).toBe(hasOpenAction);
  });

  it("treats retained starts as interrupted and keeps concurrent operations separate", () => {
    const entries = projectActivityEvents(
      [
        diagnosticEvent("ffmpeg.export.started", {
          data: { outputPath, outputType: "fast" },
          operationId: "fast-1",
          sessionId: "history-session",
          timestamp: "2026-08-30T09:00:00.000Z",
        }),
        diagnosticEvent("ffmpeg.export.started", {
          data: { outputPath: "C:/Exports/render.mp4", outputType: "optimized" },
          operationId: "render-1",
          sessionId: "history-session",
          timestamp: "2026-08-30T09:05:00.000Z",
        }),
      ],
      labels,
      "current-session",
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "history-session:fast-1:ffmpeg.export",
          status: "interrupted",
        }),
        expect.objectContaining({
          id: "history-session:render-1:ffmpeg.export",
          status: "interrupted",
        }),
      ]),
    );
  });

  it("preserves a legacy completed export without an operation ID", () => {
    const entry = projectActivityEvents(
      [
        diagnosticEvent("ffmpeg.export.completed", {
          data: { outputPath, outputType: "fast" },
          operationId: undefined,
        }),
      ],
      labels,
      "current-session",
    )[0];

    expect(entry).toMatchObject({ status: "completed", title: "Fast cut completed" });
    expect(entry?.action).toEqual({ kind: "open", path: outputPath });
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
        id: "retained-session:retained-export:ffmpeg.export",
        sessionId: "retained-session",
        startedAt: "2026-08-29T09:00:00.000Z",
      },
      {
        id: "current-session:current-export:ffmpeg.export",
        sessionId: "current-session",
        startedAt: "2026-08-31T09:00:00.000Z",
      },
    ]);
  });

  it("offers restore for completed current-session deletions while preserving open", () => {
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
    );

    expect(entries[0]?.action).toBeUndefined();
    expect(entries[1]?.action).toEqual({
      kind: "restore",
      path: sourcePath,
      targetId: "shared-target",
    });
    expect(entries[2]?.action).toEqual({ kind: "open", path: outputPath });
  });

  it("keeps a manual deletion restorable without an export queue item", () => {
    const entry = projectActivityEvent(
      diagnosticEvent("source.file-delete.completed", {
        data: { itemId: "import-1", sourcePath },
        operationId: "manual-delete",
        sessionId: "current-session",
      }),
      labels,
    );

    expect(
      resolveAvailableActivityActions(
        [entry].filter((candidate) => candidate !== null),
        "current-session",
      )[0]?.action,
    ).toEqual({
      kind: "restore",
      path: sourcePath,
      targetId: "import-1",
    });
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
