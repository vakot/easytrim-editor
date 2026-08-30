import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistDiagnosticEvent } = vi.hoisted(() => ({
  persistDiagnosticEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("../tauri/diagnostics", () => ({
  bootstrapNativeDiagnostics: vi.fn(() => Promise.resolve(null)),
  persistDiagnosticEvent,
  recordUiHeartbeat: vi.fn(() => Promise.resolve()),
}));

import { diagnostics, serializeDiagnosticError } from "../diagnostics";

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
});
