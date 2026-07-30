import { describe, expect, it } from "vitest";

import type { MediaInfo, SourceSelection } from "../lib/tauri/media";
import { initialSessionState, sessionReducer } from "./session-state";

const firstSource: SourceSelection = {
  sourceId: "source-1",
  displayName: "first.mp4",
};
const secondSource: SourceSelection = {
  sourceId: "source-2",
  displayName: "second.mkv",
};

function media(sourceId: string): MediaInfo {
  return {
    sourceId,
    formatName: "matroska,webm",
    formatLongName: "Matroska / WebM",
    durationMicros: 5_000_000,
    sizeBytes: 1_000,
    bitrate: 8_000,
    video: {
      streamIndex: 0,
      codecName: "h264",
      width: 1920,
      height: 1080,
      averageFrameRate: {
        numerator: 30_000,
        denominator: 1_001,
        displayValue: 29.970_029_970_029_97,
      },
    },
    audioStreams: [],
    chapters: [],
  };
}

describe("sessionReducer", () => {
  it("ignores metadata from a source that has already been replaced", () => {
    const loadingFirst = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const loadingSecond = sessionReducer(loadingFirst, {
      type: "source-selected",
      source: secondSource,
    });
    const staleCompletion = sessionReducer(loadingSecond, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: media(firstSource.sourceId),
    });

    expect(staleCompletion).toBe(loadingSecond);
  });

  it("keeps the failed replacement instead of restoring the previous source", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: secondSource,
    });
    const failed = sessionReducer(loading, {
      type: "source-failed",
      sourceId: secondSource.sourceId,
      error: { code: "probe_failed", message: "Inspection failed." },
    });

    expect(failed.status).toBe("failed");
    expect(failed.source?.selection).toEqual(secondSource);
    expect(failed.source?.media).toBeNull();
  });
});
