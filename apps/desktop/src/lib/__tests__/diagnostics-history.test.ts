import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeDiagnostics = vi.hoisted(() => ({
  listPersistedDiagnosticSessions: vi.fn(),
  readPersistedDiagnosticSessionEvents: vi.fn(),
}));

const diagnostics = vi.hoisted(() => ({
  getCurrentDiagnosticSessionId: vi.fn(() => "current-session"),
  reportDiagnosticsUnavailable: vi.fn(),
}));

vi.mock("../tauri/diagnostics", () => nativeDiagnostics);
vi.mock("../diagnostics", () => diagnostics);

function event(sessionId: string, operationId: string) {
  return {
    category: "ffmpeg",
    event: "ffmpeg.export.completed" as const,
    level: "info" as const,
    operationId,
    result: "success" as const,
    sessionId,
    timestamp: "2026-08-31T09:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("persisted diagnostics history", () => {
  it("loads once, excludes the current session, and publishes retained events", async () => {
    nativeDiagnostics.listPersistedDiagnosticSessions.mockResolvedValue([
      {
        appVersion: "1.3.0",
        endedAt: null,
        gracefulShutdown: false,
        sessionId: "current-session",
        startedAt: "2026-08-31T09:00:00Z",
      },
      {
        appVersion: "1.2.0",
        endedAt: "2026-08-30T10:00:00Z",
        gracefulShutdown: true,
        sessionId: "retained-session",
        startedAt: "2026-08-30T09:00:00Z",
      },
    ]);
    nativeDiagnostics.readPersistedDiagnosticSessionEvents.mockResolvedValue([
      event("retained-session", "export-1"),
      event("current-session", "export-2"),
    ]);
    const history = await import("../diagnostics-history");
    const listener = vi.fn();
    history.subscribeToPersistedDiagnosticsHistory(listener);

    const firstLoad = history.loadPersistedDiagnosticsHistory();
    const secondLoad = history.loadPersistedDiagnosticsHistory();
    expect(firstLoad).toBe(secondLoad);
    await firstLoad;

    expect(nativeDiagnostics.listPersistedDiagnosticSessions).toHaveBeenCalledOnce();
    expect(nativeDiagnostics.readPersistedDiagnosticSessionEvents).toHaveBeenCalledOnce();
    expect(history.getPersistedDiagnosticsHistorySnapshot()).toMatchObject({
      events: [event("retained-session", "export-1")],
      loaded: true,
      sessions: [
        expect.objectContaining({
          appVersion: "1.2.0",
          sessionId: "retained-session",
          startedAt: "2026-08-30T09:00:00Z",
        }),
      ],
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps readable sessions when another retained session fails", async () => {
    nativeDiagnostics.listPersistedDiagnosticSessions.mockResolvedValue([
      {
        appVersion: null,
        endedAt: null,
        gracefulShutdown: false,
        sessionId: "unreadable-session",
        startedAt: "2026-08-30T10:00:00Z",
      },
      {
        appVersion: "1.3.0",
        endedAt: null,
        gracefulShutdown: false,
        sessionId: "readable-session",
        startedAt: "2026-08-29T10:00:00Z",
      },
    ]);
    nativeDiagnostics.readPersistedDiagnosticSessionEvents.mockImplementation(
      async (sessionId: string) => {
        if (sessionId === "unreadable-session") throw new Error("unreadable");
        return [event(sessionId, "export-1")];
      },
    );
    const history = await import("../diagnostics-history");

    await history.loadPersistedDiagnosticsHistory();

    expect(history.getPersistedDiagnosticsHistorySnapshot().events).toEqual([
      event("readable-session", "export-1"),
    ]);
    expect(diagnostics.reportDiagnosticsUnavailable).toHaveBeenCalledOnce();
  });
});
