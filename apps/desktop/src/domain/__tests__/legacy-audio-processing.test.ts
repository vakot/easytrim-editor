import { describe, expect, it } from "vitest";

import {
  migrateAudioTrackProcessing,
  migrateAudioTrackSelection,
} from "../legacy-audio-processing";

describe("legacy stage-based processing migration", () => {
  it("keeps the current model unchanged", () => {
    const processing = { filters: [{ gainDb: 3, id: "g", type: "gain" }], volume: 2 };
    expect(migrateAudioTrackProcessing(processing)).toEqual({ processing });
  });

  it("converts manual gain into equivalent Track Volume without inserting a Gain filter", () => {
    const migrated = migrateAudioTrackProcessing({ gainDb: -6 });
    expect(migrated?.processing.filters).toEqual([]);
    expect(migrated?.processing.volume).toBeCloseTo(10 ** (-6 / 20), 12);
    expect(migrateAudioTrackProcessing({ gainDb: 0 })?.processing).toEqual({
      filters: [],
      volume: 1,
    });
  });

  it("keeps gain above 500% as a trailing Gain filter instead of losing level", () => {
    const migrated = migrateAudioTrackProcessing({ gainDb: 18 })!.processing;
    expect(migrated.volume).toBe(5);
    expect(migrated.filters).toHaveLength(1);
    expect(migrated.filters[0]).toMatchObject({ type: "gain" });
    const totalDb =
      20 * Math.log10(migrated.volume) + (migrated.filters[0] as { gainDb: number }).gainDb;

    expect(totalDb).toBeCloseTo(18, 9);
  });

  it("preserves stage order and keeps limited gain at its original position", () => {
    const migrated = migrateAudioTrackProcessing({
      effects: [
        { ceilingDb: -2, stage: "finalProtection", type: "limiter" },
        { preset: "strong", stage: "cleanup", type: "noiseReduction" },
        { cutoffHz: 300, stage: "finalProtection", type: "highPass" },
        { cutoffHz: 120, stage: "cleanup", type: "highPass" },
      ],
      gainDb: 6,
    })!.processing;

    expect(migrated.volume).toBe(1);
    expect(migrated.filters.map(({ type }) => type)).toEqual([
      "highPass",
      "noiseReduction",
      "gain",
      "highPass",
      "limiter",
    ]);
    expect(migrated.filters[1]).toMatchObject({ noiseFloorDb: -30, reductionDb: 20 });
    expect(migrated.filters[4]).toMatchObject({ attackMs: 5, ceilingDb: -2, releaseMs: 50 });
    expect(new Set(migrated.filters.map(({ id }) => id)).size).toBe(5);
  });

  it("migrates normalization at the level-policy position and drops its dormant gain", () => {
    const migrated = migrateAudioTrackProcessing({
      effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
      gainDb: -4,
      loudnessNormalization: "broadcast",
    })!;

    expect(migrated.processing.volume).toBe(1);
    expect(migrated.processing.filters).toEqual([
      {
        id: "legacy-1",
        loudnessRangeLu: 11,
        maxTruePeakDb: -2,
        targetLufs: -23,
        type: "loudnessNormalization",
      },
      { attackMs: 5, ceilingDb: -1, id: "legacy-2", releaseMs: 50, type: "limiter" },
    ]);
    expect(migrated.normalizationFilterId).toBe("legacy-1");
  });

  it("rejects invalid legacy values", () => {
    expect(migrateAudioTrackProcessing({ gainDb: Number.NaN })).toBeUndefined();
    expect(
      migrateAudioTrackProcessing({
        effects: [{ preset: "loud", stage: "cleanup", type: "noiseReduction" }],
        gainDb: 0,
      }),
    ).toBeUndefined();
    expect(
      migrateAudioTrackProcessing({ gainDb: 0, loudnessNormalization: "unknown" }),
    ).toBeUndefined();
  });

  it("assigns a stored request's single measurement to its normalization instance", () => {
    expect(
      migrateAudioTrackSelection({
        loudnessAnalysis: { integratedLufs: -20, truePeakDb: -6 },
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
        streamIndex: 2,
      }),
    ).toEqual({
      filters: [
        {
          id: "legacy-1",
          loudnessRangeLu: 11,
          maxTruePeakDb: -1.5,
          targetLufs: -16,
          type: "loudnessNormalization",
        },
      ],
      loudnessMeasurements: [{ filterId: "legacy-1", integratedLufs: -20, truePeakDb: -6 }],
      streamIndex: 2,
      volume: 1,
    });
  });
});
