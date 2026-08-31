import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistDiagnosticEvent } = vi.hoisted(() => ({
  persistDiagnosticEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("../tauri/diagnostics", () => ({
  bootstrapNativeDiagnostics: vi.fn(() => Promise.resolve(null)),
  persistDiagnosticEvent,
  recordUiHeartbeat: vi.fn(() => Promise.resolve()),
}));

import {
  diagnostics,
  getCurrentSessionDiagnosticsSnapshot,
  serializeDiagnosticError,
  subscribeToCurrentSessionDiagnostics,
} from "../diagnostics";

describe("diagnostics", () => {
  beforeEach(() => {
    persistDiagnosticEvent.mockClear();
  });

  it("persists structured events", () => {
    diagnostics.event("timeline.seek.requested", {
      data: { targetMicros: 42 },
      origin: { id: "playhead", type: "timeline" },
    });

    expect(persistDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "timeline",
        event: "timeline.seek.requested",
        origin: { id: "playhead", type: "timeline" },
      }),
    );
  });

  it("records user intent without operation lifecycle result", () => {
    diagnostics.action("source.open.requested", { id: "Ctrl+O", type: "hotkey" });

    expect(persistDiagnosticEvent).toHaveBeenLastCalledWith({
      category: "source",
      event: "source.open.requested",
      level: "info",
      origin: { id: "Ctrl+O", type: "hotkey" },
    });
  });

  it("exposes emitted events through the current-session journal", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToCurrentSessionDiagnostics(listener);
    const previousCount = getCurrentSessionDiagnosticsSnapshot().events.length;

    diagnostics.event("source.file-delete.completed", {
      operationId: "delete-operation-1",
      result: "success",
    });

    const events = getCurrentSessionDiagnosticsSnapshot().events;
    expect(events).toHaveLength(previousCount + 1);
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        event: "source.file-delete.completed",
        operationId: "delete-operation-1",
        sessionId: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    diagnostics.event("timeline.seek.completed");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("tracks operation timing, parentage, and one terminal event", () => {
    const parent = diagnostics.startOperation("snapshot.switch");
    const child = parent.child("preview.prepare");

    expect(diagnostics.getActiveOperations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationId: parent.operationId }),
        expect.objectContaining({
          operationId: child.operationId,
          parentOperationId: parent.operationId,
        }),
      ]),
    );
    expect(child.complete()).toBe(true);
    expect(child.complete()).toBe(false);
    expect(diagnostics.getActiveOperations()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ operationId: child.operationId })]),
    );
    expect(persistDiagnosticEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
        event: "preview.prepare.completed",
        operationId: child.operationId,
        parentOperationId: parent.operationId,
        result: "success",
      }),
    );
    parent.cancel();
  });

  it("serializes errors, nested causes, and arbitrary rejection values", () => {
    const cause = new Error("inner");
    const serialized = serializeDiagnosticError(new TypeError("outer", { cause }));

    expect(serialized).toEqual(
      expect.objectContaining({
        cause: expect.objectContaining({ message: "inner", name: "Error" }),
        message: "outer",
        name: "TypeError",
        stack: expect.stringContaining("outer"),
      }),
    );
    expect(serializeDiagnosticError({ code: "native_failed" })).toEqual({
      message: '{"code":"native_failed"}',
      name: "NonErrorRejection",
    });
  });

  it("bounds persistence failure fallback without throwing or recursive logging", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    persistDiagnosticEvent.mockRejectedValueOnce(new Error("storage unavailable"));
    persistDiagnosticEvent.mockRejectedValueOnce(new Error("storage still unavailable"));

    expect(() => diagnostics.event("diagnostics.persistence.failed")).not.toThrow();
    expect(() => diagnostics.event("diagnostics.persistence.failed")).not.toThrow();
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(consoleError).toHaveBeenCalledWith(
      "[diagnostics] Persistent diagnostics unavailable",
      expect.objectContaining({ message: "storage unavailable", name: "Error" }),
    );
    expect(persistDiagnosticEvent).toHaveBeenCalledTimes(2);

    persistDiagnosticEvent.mockResolvedValueOnce(undefined);
    diagnostics.event("diagnostics.persistence.recovered");
    await vi.waitFor(() => expect(persistDiagnosticEvent).toHaveBeenCalledTimes(3));
    await Promise.resolve();

    persistDiagnosticEvent.mockRejectedValueOnce(new Error("storage unavailable again"));
    diagnostics.event("diagnostics.persistence.failed");
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
  });
});
