import { describe, expect, it } from "vitest";

import {
  areAudioFiltersValid,
  AUDIO_FILTER_PRESETS,
  type AudioFilter,
  audioFiltersRequireLoudnessAnalysis,
  audioSyncOffsetRange,
  audioTimelineBoundaries,
  audioTrackLoudnessInputsKey,
  clampTrackVolume,
  cloneAudioTrackProcessing,
  createAudioFilter,
  effectiveAudioOffsetMicros,
  insertAudioFilter,
  matchingAudioFilterPreset,
  moveAudioFilter,
  normalizeAudioTrackDefaults,
  parseAudioTrackProcessing,
  removeAudioFilter,
  replaceAudioFilter,
  sameAudioFilters,
  sameLoudnessInputs,
  serializeAudioTrackSettings,
} from "../audio-processing";

const highPass = (id: string, cutoffHz = 80): AudioFilter => ({
  enabled: true,
  cutoffHz,
  id,
  type: "highPass",
});

const gain = (id: string, gainDb: number): AudioFilter => ({
  enabled: true,
  gainDb,
  id,
  type: "gain",
});

const normalization = (id: string, targetLufs = -16): AudioFilter => ({
  enabled: true,
  id,
  loudnessRangeLu: 11,
  maxTruePeakDb: -1.5,
  targetLufs,
  type: "loudnessNormalization",
});

const limiter = (id: string, ceilingDb = -1): AudioFilter => ({
  enabled: true,
  attackMs: 5,
  ceilingDb,
  id,
  releaseMs: 50,
  type: "limiter",
});

const trim = { endMicros: 4_000_000, startMicros: 1_000_000 };

describe("audio track metadata", () => {
  it("serializes output metadata under metadata and normalizes its language code", () => {
    expect(
      serializeAudioTrackSettings({
        enabled: true,
        metadata: { isDefault: true, language: "ru", title: "Commentary" },
        processing: { filters: [gain("g", -2)], volume: 0.5 },
        streamIndex: 4,
      }),
    ).toEqual({
      enabled: true,
      metadata: { isDefault: true, language: "rus", title: "Commentary" },
      processing: { filters: [gain("g", -2)], volume: 0.5 },
      streamIndex: 4,
    });
  });

  it("keeps the default flag under metadata while normalizing disabled tracks", () => {
    const processing = { filters: [], volume: 1 };
    expect(
      normalizeAudioTrackDefaults([
        { enabled: false, metadata: { isDefault: true }, processing, streamIndex: 2 },
        { enabled: true, metadata: { isDefault: false }, processing, streamIndex: 4 },
      ]).map((track) => track.metadata.isDefault),
    ).toEqual([false, true]);
  });
});

describe("ordered filter chain editing", () => {
  it("inserts after the selected instance and keeps repeated types as separate instances", () => {
    const filters = insertAudioFilter([gain("a", 3), highPass("hp")], gain("b", -6), "a");
    expect(filters.map(({ id }) => id)).toEqual(["a", "b", "hp"]);
    expect(insertAudioFilter(filters, limiter("lim")).map(({ id }) => id)).toEqual([
      "a",
      "b",
      "hp",
      "lim",
    ]);
  });

  it("moves, replaces, and removes instances by stable identity", () => {
    const filters = [gain("a", 3), highPass("hp"), limiter("lim")];
    const moved = moveAudioFilter(filters, "lim", 0);
    expect(moved.map(({ id }) => id)).toEqual(["lim", "a", "hp"]);
    expect(moveAudioFilter(moved, "lim", 99).map(({ id }) => id)).toEqual(["a", "hp", "lim"]);
    expect(replaceAudioFilter(moved, gain("a", -12))[1]).toEqual(gain("a", -12));
    expect(removeAudioFilter(moved, "hp").map(({ id }) => id)).toEqual(["lim", "a"]);
  });

  it("creates new instances with default explicit parameters", () => {
    expect(createAudioFilter("noiseReduction", "nr")).toEqual({
      enabled: true,
      id: "nr",
      noiseFloorDb: -35,
      reductionDb: 12,
      type: "noiseReduction",
    });
  });

  it("validates identifiers and every parameter range", () => {
    expect(areAudioFiltersValid([gain("a", 0), gain("b", 24)])).toBe(true);
    expect(areAudioFiltersValid([gain("a", 0), gain("a", 1)])).toBe(false);
    expect(areAudioFiltersValid([gain("bad id", 0)])).toBe(false);
    expect(areAudioFiltersValid([gain("a", 25)])).toBe(false);
    expect(areAudioFiltersValid([highPass("hp", 5)])).toBe(false);
    expect(
      areAudioFiltersValid([{ ...limiter("lim"), releaseMs: Number.NaN } as AudioFilter]),
    ).toBe(false);
  });

  it("compares chains independently of object key order", () => {
    const reordered = { enabled: true, type: "gain", gainDb: 3, id: "a" } as AudioFilter;
    expect(sameAudioFilters([gain("a", 3)], [reordered])).toBe(true);
    expect(sameAudioFilters([gain("a", 3), highPass("hp")], [highPass("hp"), gain("a", 3)])).toBe(
      false,
    );
  });
});

describe("presets", () => {
  it("match only explicit parameters and never become part of the filter", () => {
    const preset = AUDIO_FILTER_PRESETS.noiseReduction.find(({ id }) => id === "strong")!;
    const filter = { ...createAudioFilter("noiseReduction", "nr"), ...preset.parameters };
    expect(filter).not.toHaveProperty("preset");
    expect(matchingAudioFilterPreset(filter)).toBe("strong");
    expect(matchingAudioFilterPreset({ ...filter, reductionDb: 21 })).toBeUndefined();
  });
});

describe("loudness measurement identity", () => {
  it("is null without a normalization instance", () => {
    expect(audioTrackLoudnessInputsKey("source", 1, trim, [gain("a", 3)])).toBeNull();
  });

  it("changes with upstream filters, order, and range but not downstream processing", () => {
    const base = [highPass("hp"), normalization("norm")];
    const key = audioTrackLoudnessInputsKey("source", 1, trim, base);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [...base, gain("post", 6), limiter("lim")]),
    ).toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [highPass("hp"), normalization("norm", -23)]),
    ).toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [highPass("hp", 100), normalization("norm")]),
    ).not.toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [normalization("norm"), highPass("hp")]),
    ).not.toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, { ...trim, endMicros: 5_000_000 }, base),
    ).not.toBe(key);
  });

  it("ignores disabled filters, which are never measured or processed", () => {
    const base = [highPass("hp"), normalization("norm")];
    const key = audioTrackLoudnessInputsKey("source", 1, trim, base);
    const bypassed = (filter: AudioFilter): AudioFilter => ({ ...filter, enabled: false });

    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [
        bypassed(gain("pre", 12)),
        highPass("hp"),
        normalization("norm"),
        bypassed(normalization("late")),
      ]),
    ).toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [
        highPass("hp"),
        bypassed(normalization("norm")),
      ]),
    ).toBeNull();
    expect(audioFiltersRequireLoudnessAnalysis([bypassed(normalization("norm"))])).toBe(false);
    expect(sameAudioFilters(base, [highPass("hp"), bypassed(normalization("norm"))])).toBe(false);
  });

  it("includes earlier normalization targets when a later instance depends on them", () => {
    const chain = [normalization("first", -20), gain("g", 3), normalization("second")];
    expect(
      sameLoudnessInputs(chain, [
        normalization("first", -14),
        gain("g", 3),
        normalization("second"),
      ]),
    ).toBe(false);
    expect(sameLoudnessInputs(chain, [...chain, limiter("lim")])).toBe(true);
  });
});

describe("track volume", () => {
  it("parses only the current model and bounds Track Volume to 0-500%", () => {
    expect(parseAudioTrackProcessing({ filters: [gain("g", 3)], volume: 3.5 })).toEqual({
      filters: [gain("g", 3)],
      volume: 3.5,
    });
    expect(parseAudioTrackProcessing({ filters: [], volume: 5.5 })).toBeUndefined();
    expect(parseAudioTrackProcessing({ gainDb: 0 })).toBeUndefined();
    expect(clampTrackVolume(7)).toBe(5);
    expect(clampTrackVolume(-1)).toBe(0);
  });

  it("restores the enabled state and enables filters saved before it existed", () => {
    expect(
      parseAudioTrackProcessing({
        filters: [
          { gainDb: 3, id: "saved", type: "gain" },
          { ...gain("off", 3), enabled: false },
        ],
        volume: 1,
      })?.filters.map(({ enabled }) => enabled),
    ).toEqual([true, false]);
    expect(
      parseAudioTrackProcessing({ filters: [{ ...gain("g", 3), enabled: "no" }], volume: 1 }),
    ).toBeUndefined();
  });
});

describe("audio sync offset serialization", () => {
  it("derives the editable range from the original stream and video boundaries", () => {
    expect(audioSyncOffsetRange(30_000_000, 3_000_000, 20_000_000)).toEqual({
      minOffsetMicros: -23_000_000,
      maxOffsetMicros: 27_000_000,
    });
    expect(audioSyncOffsetRange(5_000_000, undefined, undefined)).toEqual({
      minOffsetMicros: -5_000_000,
      maxOffsetMicros: 5_000_000,
    });
    expect(audioSyncOffsetRange(5_000_000, 2_000_000, undefined)).toEqual({
      minOffsetMicros: -7_000_000,
      maxOffsetMicros: 3_000_000,
    });
  });

  it("keeps long streams available when negative offsets move their tail into the video timeline", () => {
    expect(
      audioTimelineBoundaries(10_000_000, 0, 20_000_000, {
        enabled: true,
        offsetMicros: -15_000_000,
      }),
    ).toMatchObject({
      effectiveEndMicros: 5_000_000,
      effectiveStartMicros: -15_000_000,
      hasVisibleAudio: true,
      visibleEndMicros: 5_000_000,
      visibleStartMicros: 0,
    });
  });

  it.each([true, false])("retains an enabled=%s offset independently of filters", (enabled) => {
    const processing = {
      filters: [gain("g", 3)],
      volume: 1,
      syncOffset: { enabled, offsetMicros: -500_001 },
    };

    const restored = parseAudioTrackProcessing(JSON.parse(JSON.stringify(processing)));
    expect(restored).toEqual(processing);
    expect(cloneAudioTrackProcessing(processing)).toEqual(processing);
    expect(cloneAudioTrackProcessing(processing).syncOffset).not.toBe(processing.syncOffset);
    expect(effectiveAudioOffsetMicros(restored?.syncOffset)).toBe(enabled ? -500_001 : 0);
  });
  it.each([NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid time %s",
    (offsetMicros) => {
      expect(
        parseAudioTrackProcessing({
          filters: [],
          volume: 1,
          syncOffset: { enabled: true, offsetMicros },
        }),
      ).toBeUndefined();
    },
  );
});
