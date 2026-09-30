import { describe, expect, it } from "vitest";

import {
  audioTrackActivityProcessingChanged,
  audioTrackExternalPreviewStreamIndexes,
  audioTrackLevelMode,
  audioTrackLoudnessInputsKey,
  audioTrackNormalizationGainDb,
  audioTrackRequiresProcessedPreview,
  effectiveAudioTrackGainDb,
  getAudioTrackSignalEffect,
  getAudioTrackSignalEffects,
  loudnessNormalizationTargets,
  removeAudioTrackSignalEffect,
  sameAudioTrackLoudnessInputs,
  setAudioTrackSignalEffect,
} from "../audio-processing";

describe("audio track level policy", () => {
  it("selects external preview tracks from the active playback route", () => {
    const manualA = { enabled: true, processing: { gainDb: 0 }, streamIndex: 2 };
    const manualB = { enabled: true, processing: { gainDb: 0 }, streamIndex: 4 };
    const normalizedA = {
      ...manualA,
      processing: { gainDb: 0, loudnessNormalization: "streaming" as const },
    };

    const effectedA = {
      ...manualA,
      processing: {
        gainDb: 0,
        effects: [{ cutoffHz: 100, stage: "cleanup" as const, type: "highPass" as const }],
      },
    };

    const manualGainOnly = { ...manualA, processing: { gainDb: -6 } };

    expect(audioTrackExternalPreviewStreamIndexes([manualA], 2)).toEqual([]);
    expect(audioTrackExternalPreviewStreamIndexes([manualGainOnly], 2)).toEqual([]);
    expect(audioTrackRequiresProcessedPreview(manualGainOnly.processing)).toBe(false);
    expect(audioTrackRequiresProcessedPreview(effectedA.processing)).toBe(true);
    expect(audioTrackExternalPreviewStreamIndexes([effectedA], 2)).toEqual([2]);
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
    const upstreamProcessing = {
      ...processing,
      effects: [{ type: "highPass" as const, stage: "cleanup" as const, cutoffHz: 100 }],
    };

    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, upstreamProcessing)).not.toBe(initial);
    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, upstreamProcessing)).toBe(
      audioTrackLoudnessInputsKey("source-a", 2, trim, upstreamProcessing),
    );
    const finalProtectionProcessing = {
      ...processing,
      effects: [{ type: "highPass" as const, stage: "finalProtection" as const, cutoffHz: 120 }],
    };

    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, finalProtectionProcessing)).toBe(
      initial,
    );
    expect(sameAudioTrackLoudnessInputs(processing, finalProtectionProcessing)).toBe(true);
    expect(audioTrackActivityProcessingChanged(processing, finalProtectionProcessing)).toBe(true);
    expect(audioTrackLoudnessInputsKey("source-b", 2, trim, processing)).not.toBe(initial);
    expect(sameAudioTrackLoudnessInputs(processing, { ...processing, gainDb: 2 })).toBe(true);
    expect(sameAudioTrackLoudnessInputs(processing, upstreamProcessing)).toBe(false);
  });

  it("keys loudness analysis differently for each noise-reduction preset", () => {
    const trim = { startMicros: 0, endMicros: 4_000_000 };
    const keyForPreset = (preset: "light" | "medium" | "strong") =>
      audioTrackLoudnessInputsKey("source-a", 2, trim, {
        gainDb: 0,
        effects: [{ preset, stage: "cleanup", type: "noiseReduction" }],
      });

    expect(keyForPreset("light")).not.toBe(keyForPreset("medium"));
    expect(keyForPreset("medium")).not.toBe(keyForPreset("strong"));
  });

  it("keeps same-stage signal effects in canonical order as effects are added and updated", () => {
    const highPass = { cutoffHz: 120, stage: "cleanup", type: "highPass" } as const;
    const noiseReduction = {
      preset: "medium",
      stage: "cleanup",
      type: "noiseReduction",
    } as const;

    const highPassThenNoiseReduction = setAudioTrackSignalEffect(
      setAudioTrackSignalEffect({ gainDb: 0 }, highPass),
      noiseReduction,
    );

    const noiseReductionThenHighPass = setAudioTrackSignalEffect(
      setAudioTrackSignalEffect({ gainDb: 0 }, noiseReduction),
      highPass,
    );

    expect(getAudioTrackSignalEffects(highPassThenNoiseReduction)).toEqual([
      highPass,
      noiseReduction,
    ]);
    expect(getAudioTrackSignalEffects(noiseReductionThenHighPass)).toEqual(
      getAudioTrackSignalEffects(highPassThenNoiseReduction),
    );
    expect(
      getAudioTrackSignalEffect(
        setAudioTrackSignalEffect(highPassThenNoiseReduction, {
          ...noiseReduction,
          preset: "strong",
        }),
        "noiseReduction",
      )?.preset,
    ).toBe("strong");
    expect(
      getAudioTrackSignalEffects(
        setAudioTrackSignalEffect(highPassThenNoiseReduction, {
          ...noiseReduction,
          preset: "strong",
        }),
      )[0],
    ).toEqual(highPass);
    const duplicateNoiseReduction = setAudioTrackSignalEffect(
      {
        gainDb: 0,
        effects: [
          { ...noiseReduction, preset: "light" },
          { ...noiseReduction, preset: "medium" },
          highPass,
        ],
      },
      { ...noiseReduction, preset: "strong" },
    );

    expect(
      getAudioTrackSignalEffects(duplicateNoiseReduction).filter(
        (effect) => effect.type === "noiseReduction",
      ),
    ).toEqual([{ ...noiseReduction, preset: "strong" }]);
  });

  it("removes a signal effect without disturbing other processing", () => {
    expect(
      removeAudioTrackSignalEffect(
        {
          gainDb: -3,
          effects: [{ preset: "light", stage: "cleanup", type: "noiseReduction" }],
          loudnessNormalization: "streaming",
        },
        "noiseReduction",
      ),
    ).toEqual({ gainDb: -3, loudnessNormalization: "streaming" });
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
