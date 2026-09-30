import { describe, expect, it } from "vitest";

import {
  audioTrackActivityProcessingChanged,
  audioTrackExternalPreviewStreamIndexes,
  audioTrackLevelMode,
  audioTrackLoudnessInputsKey,
  audioTrackNormalizationGainDb,
  effectiveAudioTrackGainDb,
  loudnessNormalizationTargets,
  sameAudioTrackLoudnessInputs,
} from "../audio-processing";

describe("audio track level policy", () => {
  it("selects external preview tracks from the active playback route", () => {
    const manualA = { enabled: true, processing: { gainDb: 0 }, streamIndex: 2 };
    const manualB = { enabled: true, processing: { gainDb: 0 }, streamIndex: 4 };
    const normalizedA = {
      ...manualA,
      processing: { gainDb: 0, loudnessNormalization: "streaming" as const },
    };

    expect(audioTrackExternalPreviewStreamIndexes([manualA], 2)).toEqual([]);
    expect(audioTrackExternalPreviewStreamIndexes([normalizedA], 2)).toEqual([2]);
    expect(audioTrackExternalPreviewStreamIndexes([manualA], 4)).toEqual([2]);
    expect(audioTrackExternalPreviewStreamIndexes([normalizedA, manualB], 2)).toEqual([2, 4]);
    expect(
      audioTrackExternalPreviewStreamIndexes([manualA, { ...manualB, enabled: false }], 2),
    ).toEqual([]);
  });

  it("uses normalization instead of manual gain while preserving the stored gain", () => {
    const processing = { gainDb: -2.5, loudnessNormalization: "streaming" as const };

    expect(audioTrackLevelMode(processing)).toBe("normalized");
    expect(effectiveAudioTrackGainDb(processing)).toBe(0);
    expect(processing.gainDb).toBe(-2.5);
    expect(effectiveAudioTrackGainDb({ gainDb: processing.gainDb })).toBe(-2.5);
  });

  it("treats normalization targets as analysis independent and reports its level targets", () => {
    expect(loudnessNormalizationTargets("streaming")).toEqual({
      maxTruePeakDb: -1.5,
      targetLufs: -16,
    });
    expect(
      audioTrackActivityProcessingChanged(
        { gainDb: -5, loudnessNormalization: "streaming" },
        { gainDb: 7, loudnessNormalization: "streaming" },
      ),
    ).toBe(false);
  });

  it("keys loudness analysis by trim and explicit pre-level processing inputs", () => {
    const trim = { startMicros: 1_000_000, endMicros: 8_000_000 };
    const processing = { gainDb: -4, loudnessNormalization: "streaming" as const };
    const initial = audioTrackLoudnessInputsKey("source-a", 2, trim, processing);
    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, processing)).toBe(initial);
    expect(
      audioTrackLoudnessInputsKey("source-a", 2, { ...trim, startMicros: 2_000_000 }, processing),
    ).not.toBe(initial);
    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, { ...processing, gainDb: 2 })).toBe(
      initial,
    );
    expect(
      audioTrackLoudnessInputsKey("source-a", 2, trim, {
        ...processing,
        loudnessNormalization: { mode: "custom", targetLufs: -18, maxTruePeakDb: -2 },
      }),
    ).toBe(initial);
    const upstreamProcessing = { ...processing, highPass: { cutoffHz: 100 } };
    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, upstreamProcessing)).not.toBe(initial);
    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, upstreamProcessing)).toBe(
      audioTrackLoudnessInputsKey("source-a", 2, trim, upstreamProcessing),
    );
    expect(audioTrackLoudnessInputsKey("source-b", 2, trim, processing)).not.toBe(initial);
    expect(sameAudioTrackLoudnessInputs(processing, { ...processing, gainDb: 2 })).toBe(true);
    expect(sameAudioTrackLoudnessInputs(processing, upstreamProcessing)).toBe(false);
  });

  it("normalizes from one cached pre-level measurement while respecting true peak", () => {
    expect(
      audioTrackNormalizationGainDb("streaming", { integratedLufs: -20, truePeakDb: -5 }),
    ).toBe(3.5);
    expect(
      audioTrackNormalizationGainDb("streaming", { integratedLufs: -10, truePeakDb: -3 }),
    ).toBe(-6);
    expect(audioTrackNormalizationGainDb("streaming", {})).toBe(0);
  });
});
