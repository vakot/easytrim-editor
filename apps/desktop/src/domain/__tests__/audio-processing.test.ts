import { describe, expect, it } from "vitest";

import {
  AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS,
  audioTrackActivityProcessingChanged,
  audioTrackExternalPreviewStreamIndexes,
  audioTrackLevelMode,
  audioTrackLoudnessInputsKey,
  audioTrackNormalizationGainDb,
  audioTrackPreviewProcessing,
  audioTrackPreviewRuntimeGainDb,
  type AudioTrackProcessing,
  audioTrackRequiresProcessedPreview,
  effectiveAudioTrackGainDb,
  getAudioTrackSignalEffect,
  getAudioTrackSignalEffects,
  limitAudioPreviewSample,
  loudnessNormalizationTargets,
  normalizeAudioTrackDefaults,
  parseAudioTrackSignalEffects,
  removeAudioTrackSignalEffect,
  sameAudioTrackLoudnessInputs,
  sameAudioTrackPreviewProcessing,
  serializeAudioTrackSettings,
  setAudioTrackSignalEffect,
} from "../audio-processing";

describe("audio track metadata", () => {
  it("serializes output metadata under metadata and normalizes its language code", () => {
    expect(
      serializeAudioTrackSettings({
        enabled: true,
        metadata: { isDefault: true, language: "ru", title: "Commentary" },
        processing: { gainDb: -2 },
        streamIndex: 4,
      }),
    ).toEqual({
      enabled: true,
      metadata: { isDefault: true, language: "rus", title: "Commentary" },
      processing: { gainDb: -2 },
      streamIndex: 4,
    });
  });

  it("keeps the default flag under metadata while normalizing disabled tracks", () => {
    expect(
      normalizeAudioTrackDefaults([
        {
          enabled: false,
          metadata: { isDefault: true, title: "Disabled" },
          processing: { gainDb: 0 },
          streamIndex: 2,
        },
        {
          enabled: true,
          metadata: { isDefault: false, language: "rus" },
          processing: { gainDb: 0 },
          streamIndex: 4,
        },
      ]),
    ).toEqual([
      {
        enabled: false,
        metadata: { isDefault: false, title: "Disabled" },
        processing: { gainDb: 0 },
        streamIndex: 2,
      },
      {
        enabled: true,
        metadata: { isDefault: true, language: "rus" },
        processing: { gainDb: 0 },
        streamIndex: 4,
      },
    ]);
  });
});

describe("audio track level policy", () => {
  it("selects external preview tracks from the active playback route", () => {
    const manualA = { enabled: true, metadata: {}, processing: { gainDb: 0 }, streamIndex: 2 };
    const manualB = { enabled: true, metadata: {}, processing: { gainDb: 0 }, streamIndex: 4 };
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

  it("bakes manual gain into limited previews and leaves linear gain runtime-only", () => {
    const limited = {
      gainDb: 6,
      effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
    } satisfies AudioTrackProcessing;

    const linear = { gainDb: 6 };

    expect(audioTrackPreviewProcessing(limited)).toEqual(limited);
    expect(audioTrackPreviewRuntimeGainDb(limited, limited)).toBe(0);
    expect(audioTrackPreviewRuntimeGainDb(limited, limited, 8)).toBe(2);
    expect(audioTrackPreviewProcessing(linear)).toEqual({ gainDb: 0 });
    expect(audioTrackPreviewRuntimeGainDb(linear, { gainDb: 0 })).toBe(6);
    expect(limitAudioPreviewSample(0.9 * 10 ** (6 / 20), -1)).toBeCloseTo(10 ** (-1 / 20));
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

  it("keys loudness analysis by trim and track processing effects", () => {
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
    expect(sameAudioTrackLoudnessInputs(processing, upstreamProcessing)).toBe(false);
    const finalProtectionProcessing = {
      ...processing,
      effects: [{ type: "highPass" as const, stage: "finalProtection" as const, cutoffHz: 120 }],
    };

    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, finalProtectionProcessing)).toBe(
      initial,
    );
    expect(sameAudioTrackLoudnessInputs(processing, finalProtectionProcessing)).toBe(true);
    expect(audioTrackActivityProcessingChanged(processing, finalProtectionProcessing)).toBe(true);
    const limitedProcessing = {
      ...processing,
      effects: [{ type: "limiter" as const, stage: "finalProtection" as const, ceilingDb: -1 }],
    };

    expect(audioTrackLoudnessInputsKey("source-a", 2, trim, limitedProcessing)).toBe(initial);
    expect(sameAudioTrackLoudnessInputs(processing, limitedProcessing)).toBe(true);
    expect(audioTrackActivityProcessingChanged(processing, limitedProcessing)).toBe(true);
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

  it("includes manual gain in limited preview identity but not in linear or normalized preview identity", () => {
    const limiter = { ceilingDb: -1, stage: "finalProtection", type: "limiter" } as const;
    expect(
      sameAudioTrackPreviewProcessing(
        { gainDb: 0, effects: [limiter] },
        { gainDb: 2, effects: [limiter] },
      ),
    ).toBe(false);
    expect(sameAudioTrackPreviewProcessing({ gainDb: 0 }, { gainDb: 2 })).toBe(true);
    expect(
      sameAudioTrackPreviewProcessing(
        { gainDb: 0, loudnessNormalization: "streaming", effects: [limiter] },
        { gainDb: 2, loudnessNormalization: "streaming", effects: [limiter] },
      ),
    ).toBe(true);
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

  it("edits and disables only the cleanup high-pass across every preset", () => {
    const processing = setAudioTrackSignalEffect(
      setAudioTrackSignalEffect(
        { gainDb: -2 },
        {
          preset: "medium",
          stage: "cleanup",
          type: "noiseReduction",
        },
      ),
      { cutoffHz: 60, stage: "dynamics", type: "highPass" },
    );

    const withFinalProtectionHighPass = setAudioTrackSignalEffect(processing, {
      cutoffHz: 120,
      stage: "finalProtection",
      type: "highPass",
    });

    let currentProcessing = setAudioTrackSignalEffect(withFinalProtectionHighPass, {
      cutoffHz: 60,
      stage: "cleanup",
      type: "highPass",
    });

    for (const cutoffHz of AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS) {
      currentProcessing = setAudioTrackSignalEffect(currentProcessing, {
        cutoffHz,
        stage: "cleanup",
        type: "highPass",
      });

      const updated = currentProcessing;
      const effects = getAudioTrackSignalEffects(updated);

      expect(getAudioTrackSignalEffect(updated, "highPass", "cleanup")).toEqual({
        cutoffHz,
        stage: "cleanup",
        type: "highPass",
      });
      expect(getAudioTrackSignalEffect(updated, "highPass", "dynamics")).toEqual({
        cutoffHz: 60,
        stage: "dynamics",
        type: "highPass",
      });
      expect(getAudioTrackSignalEffect(updated, "highPass", "finalProtection")).toEqual({
        cutoffHz: 120,
        stage: "finalProtection",
        type: "highPass",
      });
      expect(effects.map(({ stage, type }) => `${stage}:${type}`)).toEqual([
        "cleanup:highPass",
        "cleanup:noiseReduction",
        "dynamics:highPass",
        "finalProtection:highPass",
      ]);
      expect(
        effects.filter(({ stage, type }) => type === "highPass" && stage === "cleanup"),
      ).toHaveLength(1);
    }

    const off = removeAudioTrackSignalEffect(currentProcessing, "highPass", "cleanup");

    expect(getAudioTrackSignalEffect(off, "highPass", "cleanup")).toBeUndefined();
    expect(getAudioTrackSignalEffects(off)).toEqual([
      { preset: "medium", stage: "cleanup", type: "noiseReduction" },
      { cutoffHz: 60, stage: "dynamics", type: "highPass" },
      { cutoffHz: 120, stage: "finalProtection", type: "highPass" },
    ]);
  });

  it("rejects invalid signal-effect stages and high-pass cutoffs in the shared parser", () => {
    expect(
      parseAudioTrackSignalEffects([{ cutoffHz: 80, stage: "levelPolicy", type: "highPass" }]),
    ).toBeUndefined();
    expect(
      parseAudioTrackSignalEffects([{ cutoffHz: 20_001, stage: "cleanup", type: "highPass" }]),
    ).toBeUndefined();
    expect(
      parseAudioTrackSignalEffects([{ cutoffHz: Number.NaN, stage: "cleanup", type: "highPass" }]),
    ).toBeUndefined();
    expect(
      parseAudioTrackSignalEffects([{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }]),
    ).toEqual([{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }]);
    expect(
      parseAudioTrackSignalEffects([{ ceilingDb: -25, stage: "finalProtection", type: "limiter" }]),
    ).toBeUndefined();
  });

  it("allows one high-pass effect per stage and rejects duplicates within a stage", () => {
    expect(
      parseAudioTrackSignalEffects([
        { cutoffHz: 60, stage: "cleanup", type: "highPass" },
        { cutoffHz: 80, stage: "cleanup", type: "highPass" },
      ]),
    ).toBeUndefined();

    expect(
      parseAudioTrackSignalEffects([
        { cutoffHz: 60, stage: "cleanup", type: "highPass" },
        { cutoffHz: 80, stage: "dynamics", type: "highPass" },
        { cutoffHz: 100, stage: "finalProtection", type: "highPass" },
      ]),
    ).toEqual([
      { cutoffHz: 60, stage: "cleanup", type: "highPass" },
      { cutoffHz: 80, stage: "dynamics", type: "highPass" },
      { cutoffHz: 100, stage: "finalProtection", type: "highPass" },
    ]);
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
