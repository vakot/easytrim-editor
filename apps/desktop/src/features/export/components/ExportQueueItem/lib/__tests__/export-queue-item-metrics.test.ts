import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  createExportAttempt,
  type ExportAttempt,
  type ExportRoute,
} from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { getFileSizeChange, getFps } from "../export-queue-item-metrics";

function createAttempt(route: ExportRoute): ExportAttempt {
  const source = { ...firstSource, fileSizeBytes: 1_000 };
  const baseRequest = {
    audioTracks: [],
    mergeAudio: false,
    sourcePath: source.sourcePath,
    trim: { endMicros: 12_000_000, startMicros: 2_000_000 },
  };
  const request =
    route === "audio"
      ? { ...baseRequest, format: "m4a" as const }
      : { ...baseRequest, rotationDegrees: 0 as const };
  const attempt = createExportAttempt({
    capturedAt: 1,
    id: `attempt-${route}`,
    output: {
      displayName: "output.mp4",
      displayPath: "C:/Exports/output.mp4",
      outputId: "output",
    },
    request,
    route,
    snapshot: createDefaultEditorSnapshot(source, false),
  });

  attempt.metrics = { ...attempt.metrics, fileSizeBytes: 2_000, fps: 30 };
  attempt.state = {
    completedAt: 2,
    result: {
      displayName: "output.mp4",
      displayPath: "C:/Exports/output.mp4",
      operationId: "operation",
    },
    status: "completed",
  };

  return attempt;
}

describe("export queue video metrics", () => {
  it("omits FPS and source size comparison for audio exports", () => {
    const attempt = createAttempt("audio");

    expect(getFps(attempt, { formatValue: (value) => value })).toBeNull();
    expect(
      getFileSizeChange(attempt, {
        formatValue: (value) => value,
      }),
    ).toBeNull();
  });

  it("keeps FPS and source size comparison for video exports", () => {
    const attempt = createAttempt("fast");

    expect(getFps(attempt, { formatValue: (value) => value })).toMatchObject({
      id: "fps",
      value: "30.0",
    });
    expect(
      getFileSizeChange(attempt, {
        formatValue: (value) => value,
      }),
    ).toMatchObject({ id: "file-size-change", value: "+100% (1000 B)" });
  });
});
