import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import {
  listPersistedDiagnosticSessions,
  readPersistedDiagnosticSessionEvents,
  revealDiagnosticLogs,
} from "../diagnostics";

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
});

describe("diagnostics IPC adapter", () => {
  it("parses retained session metadata and drops invalid entries", async () => {
    mocks.invoke.mockResolvedValue([
      {
        appVersion: "1.2.0",
        endedAt: "2026-08-31T10:00:00Z",
        gracefulShutdown: true,
        sessionId: "session-1",
        startedAt: "2026-08-31T09:00:00Z",
      },
      { sessionId: "../outside" },
    ]);

    await expect(listPersistedDiagnosticSessions()).resolves.toEqual([
      {
        appVersion: "1.2.0",
        endedAt: "2026-08-31T10:00:00Z",
        gracefulShutdown: true,
        sessionId: "session-1",
        startedAt: "2026-08-31T09:00:00Z",
      },
    ]);
    expect(mocks.invoke).toHaveBeenCalledWith("list_persisted_diagnostic_sessions");
  });

  it("reads a retained session through the narrow command and skips malformed events", async () => {
    mocks.invoke.mockResolvedValue([
      {
        category: "ffmpeg",
        data: { outputPath: "C:/Exports/clip.mp4", outputType: "fast" },
        event: "ffmpeg.export.completed",
        level: "info",
        operationId: "export-1",
        result: "success",
        sessionId: "session-1",
        timestamp: "2026-08-31T09:00:00Z",
      },
      { event: "not-valid" },
    ]);

    await expect(readPersistedDiagnosticSessionEvents("session-1")).resolves.toHaveLength(1);
    expect(mocks.invoke).toHaveBeenCalledWith("read_persisted_diagnostic_session_events", {
      sessionId: "session-1",
    });
  });

  it("reveals the diagnostic logs directory through the narrow command", async () => {
    await revealDiagnosticLogs();

    expect(mocks.invoke).toHaveBeenCalledWith("reveal_diagnostic_logs");
  });
});
