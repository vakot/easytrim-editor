import { describe, expect, it } from "vitest";

import type { MediaInfo, SourceSelection } from "../../lib/tauri/media";
import { initialSessionState, sessionReducer } from "../session-state";

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

function mediaWithAudio(sourceId: string): MediaInfo {
  return {
    ...media(sourceId),
    audioStreams: [
      {
        streamIndex: 2,
        codecName: "aac",
        channels: 2,
        channelLayout: "stereo",
        language: "eng",
        isDefault: true,
      },
      {
        streamIndex: 4,
        codecName: "ac3",
        channels: 6,
        channelLayout: "5.1",
        title: "Surround",
        isDefault: false,
      },
    ],
  };
}

describe("sessionReducer", () => {
  it("applies the saved merge default to a newly selected source", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
      mergeAudio: true,
    });

    expect(loading.source?.mergeAudio).toBe(true);

    const resetForNextSource = sessionReducer(loading, {
      type: "source-selected",
      source: secondSource,
      mergeAudio: false,
    });
    expect(resetForNextSource.source?.mergeAudio).toBe(false);
  });

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

  it("ignores a preview prepared for a replaced source", () => {
    const loadingFirst = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const loadingSecond = sessionReducer(loadingFirst, {
      type: "source-selected",
      source: secondSource,
    });
    const stalePreview = sessionReducer(loadingSecond, {
      type: "preview-ready",
      sourceId: firstSource.sourceId,
      preview: {
        sourceId: firstSource.sourceId,
        url: "http://easytrim-media.localhost/source-1?variant=source",
        kind: "source",
      },
    });

    expect(stalePreview).toBe(loadingSecond);
  });

  it("tracks direct preview fallback without failing inspected metadata", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const ready = sessionReducer(loading, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: media(firstSource.sourceId),
    });
    const preparingProxy = sessionReducer(ready, {
      type: "preview-loading",
      sourceId: firstSource.sourceId,
      kind: "proxy",
    });
    const failedProxy = sessionReducer(preparingProxy, {
      type: "preview-failed",
      sourceId: firstSource.sourceId,
      error: { code: "preview_failed", message: "Preview failed." },
    });

    expect(failedProxy.status).toBe("ready");
    expect(failedProxy.source?.media).toEqual(media(firstSource.sourceId));
    expect(failedProxy.source?.preview).toEqual({
      status: "failed",
      error: { code: "preview_failed", message: "Preview failed." },
    });
  });

  it("initializes a full trim and rejects an empty trim update", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const ready = sessionReducer(loading, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: media(firstSource.sourceId),
    });
    const invalidUpdate = sessionReducer(ready, {
      type: "trim-changed",
      sourceId: firstSource.sourceId,
      trim: {
        startMicros: 2_000_000,
        endMicros: 2_000_000,
        sourceDurationMicros: 5_000_000,
      },
    });

    expect(ready.source?.trim).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
      sourceDurationMicros: 5_000_000,
    });
    expect(invalidUpdate).toBe(ready);
  });

  it("enables discovered audio tracks and keeps selections in session memory", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const ready = sessionReducer(loading, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: mediaWithAudio(firstSource.sourceId),
    });
    const trackDisabled = sessionReducer(ready, {
      type: "audio-track-toggled",
      sourceId: firstSource.sourceId,
      streamIndex: 4,
    });
    const mergeEnabled = sessionReducer(trackDisabled, {
      type: "audio-merge-toggled",
      sourceId: firstSource.sourceId,
    });
    const allDisabled = sessionReducer(mergeEnabled, {
      type: "audio-tracks-set-enabled",
      sourceId: firstSource.sourceId,
      enabled: false,
    });
    const allEnabled = sessionReducer(allDisabled, {
      type: "audio-tracks-set-enabled",
      sourceId: firstSource.sourceId,
      enabled: true,
    });
    const sliderMuted = sessionReducer(ready, {
      type: "audio-track-volume-changed",
      sourceId: firstSource.sourceId,
      streamIndex: 2,
      volumePercent: 0,
    });
    const safelyUnmuted = sessionReducer(sliderMuted, {
      type: "audio-track-toggled",
      sourceId: firstSource.sourceId,
      streamIndex: 2,
    });
    const masterMuted = sessionReducer(ready, {
      type: "audio-master-volume-changed",
      sourceId: firstSource.sourceId,
      volumePercent: 0,
    });
    const masterUnmuted = sessionReducer(masterMuted, {
      type: "audio-master-toggled",
      sourceId: firstSource.sourceId,
    });

    expect(ready.source?.audioTracks).toEqual([
      { streamIndex: 2, enabled: true, volumePercent: 50, waveform: { status: "idle" } },
      { streamIndex: 4, enabled: true, volumePercent: 50, waveform: { status: "idle" } },
    ]);
    expect(mergeEnabled.source?.audioTracks[1]?.enabled).toBe(false);
    expect(mergeEnabled.source?.mergeAudio).toBe(true);
    expect(allDisabled.source?.audioTracks.every((track) => !track.enabled)).toBe(true);
    expect(allEnabled.source?.audioTracks.every((track) => track.enabled)).toBe(true);
    expect(safelyUnmuted.source?.audioTracks[0]?.enabled).toBe(true);
    expect(safelyUnmuted.source?.audioTracks[0]?.volumePercent).toBe(50);
    expect(masterUnmuted.source?.masterEnabled).toBe(true);
    expect(masterUnmuted.source?.masterVolumePercent).toBe(50);
  });

  it("auto-mutes a silent track without overriding a user volume choice", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const ready = sessionReducer(loading, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: mediaWithAudio(firstSource.sourceId),
    });
    const preparing = sessionReducer(ready, {
      type: "waveforms-loading",
      sourceId: firstSource.sourceId,
      jobId: "waveform-1",
      width: 800,
      streamIndexes: [2, 4],
    });
    const silentResult = sessionReducer(preparing, {
      type: "waveform-result",
      result: {
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: "waveform-1",
        streamIndex: 2,
        width: 800,
        hasSignal: false,
        url: "http://easytrim-media.localhost/source-1?variant=waveform&stream=2&width=800",
      },
    });
    const userVolume = sessionReducer(silentResult, {
      type: "audio-track-volume-changed",
      sourceId: firstSource.sourceId,
      streamIndex: 4,
      volumePercent: 25,
    });
    const silentResultAfterUserChoice = sessionReducer(userVolume, {
      type: "waveform-result",
      result: {
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: "waveform-1",
        streamIndex: 4,
        width: 800,
        hasSignal: false,
        url: "http://easytrim-media.localhost/source-1?variant=waveform&stream=4&width=800",
      },
    });

    expect(silentResult.source?.audioTracks[0]).toMatchObject({
      enabled: false,
      volumePercent: 0,
    });
    expect(silentResultAfterUserChoice.source?.audioTracks[1]).toMatchObject({
      enabled: true,
      volumePercent: 25,
    });
  });

  it("ignores stale waveform completions after regeneration", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const ready = sessionReducer(loading, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: mediaWithAudio(firstSource.sourceId),
    });
    const firstJob = sessionReducer(ready, {
      type: "waveforms-loading",
      sourceId: firstSource.sourceId,
      jobId: "waveform-1",
      width: 800,
      streamIndexes: [2, 4],
    });
    const secondJob = sessionReducer(firstJob, {
      type: "waveforms-loading",
      sourceId: firstSource.sourceId,
      jobId: "waveform-2",
      width: 1200,
      streamIndexes: [2, 4],
    });
    const staleResult = sessionReducer(secondJob, {
      type: "waveform-result",
      result: {
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: "waveform-1",
        streamIndex: 2,
        width: 800,
        url: "http://easytrim-media.localhost/source-1?variant=waveform&stream=2&width=800",
      },
    });
    const currentResult = sessionReducer(staleResult, {
      type: "waveform-result",
      result: {
        status: "failed",
        sourceId: firstSource.sourceId,
        jobId: "waveform-2",
        streamIndex: 2,
        width: 1200,
        error: { code: "waveform_failed", message: "Unavailable." },
      },
    });

    expect(staleResult).toEqual(secondJob);
    expect(currentResult.source?.audioTracks[0]?.waveform).toEqual({
      status: "failed",
      jobId: "waveform-2",
      width: 1200,
      error: { code: "waveform_failed", message: "Unavailable." },
    });
  });

  it("turns a failed waveform image into a retryable track visualization", () => {
    const loading = sessionReducer(initialSessionState, {
      type: "source-selected",
      source: firstSource,
    });
    const ready = sessionReducer(loading, {
      type: "source-ready",
      sourceId: firstSource.sourceId,
      media: mediaWithAudio(firstSource.sourceId),
    });
    const preparing = sessionReducer(ready, {
      type: "waveforms-loading",
      sourceId: firstSource.sourceId,
      jobId: "waveform-1",
      width: 800,
      streamIndexes: [2],
    });
    const prepared = sessionReducer(preparing, {
      type: "waveform-result",
      result: {
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: "waveform-1",
        streamIndex: 2,
        width: 800,
        url: "http://easytrim-media.localhost/source-1?variant=waveform&stream=2&width=800",
      },
    });
    const failedDisplay = sessionReducer(prepared, {
      type: "waveform-display-failed",
      sourceId: firstSource.sourceId,
      streamIndex: 2,
    });

    expect(failedDisplay.source?.audioTracks[0]).toEqual({
      streamIndex: 2,
      enabled: true,
      volumePercent: 50,
      waveform: {
        status: "failed",
        jobId: "waveform-1",
        width: 800,
        error: {
          code: "waveform_failed",
          message: "The waveform preview could not be displayed.",
        },
      },
    });
  });
});
